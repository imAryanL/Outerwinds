// One area of the Storm Property Record — its Before and After photos side by side.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotesEditorModal } from '@/components/notes-editor-modal';
import { PhotoViewer } from '@/components/photo-viewer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { vaultPhotoUri } from '@/db/documents';
import { deleteArea, getArea, setAreaPhoto, updateAreaNotes, type AreaRow } from '@/db/property';
import { useTheme } from '@/hooks/use-theme';
import { isPro } from '@/lib/pro';

type Slot = 'before' | 'after';

const PHOTO_QUALITY = 0.6;

// When the photo was taken, not when it was added. EXIF looks like '2026:09:23 16:32:10'
// in the phone's local time. Falls back to now when the photo has no date.
function takenAtFromExif(exif: Record<string, any> | null | undefined) {
  const raw = exif?.DateTimeOriginal;
  if (typeof raw !== 'string') {
    return new Date().toISOString();
  }

  const [datePart, timePart] = raw.split(' ');
  if (timePart === undefined) {
    return new Date().toISOString();
  }
  const [year, month, day] = datePart.split(':');
  const [hour, minute, second] = timePart.split(':');

  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeLabel(iso: string) {
  return 'Taken ' + new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

type PhotoSlotProps = {
  label: string;
  fileName: string | null;
  takenAt: string | null;
  onAdd: () => void;
  onView: (uri: string) => void;
};

// One column: the label, then the photo (or an empty box to add one), then its date.
function PhotoSlot({ label, fileName, takenAt, onAdd, onView }: PhotoSlotProps) {
  const theme = useTheme();

  if (fileName === null) {
    return (
      <View style={styles.slot}>
        <ThemedText themeColor="textSecondary" style={styles.slotLabel}>
          {label}
        </ThemedText>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label.toLowerCase()} photo`}
          style={({ pressed }) => [
            styles.photoBox,
            styles.emptyBox,
            { borderColor: theme.textTertiary, backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <MaterialCommunityIcons name="camera-outline" size={28} color={theme.primaryDeep} />
          <ThemedText themeColor="primaryDeep" style={styles.addText}>
            Add {label.toLowerCase()} photo
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Camera or library
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const uri = vaultPhotoUri(fileName);
  return (
    <View style={styles.slot}>
      <ThemedText themeColor="textSecondary" style={styles.slotLabel}>
        {label}
      </ThemedText>
      <Pressable
        onPress={() => onView(uri)}
        accessibilityRole="button"
        accessibilityLabel={`View ${label.toLowerCase()} photo`}
        style={({ pressed }) => [pressed && styles.pressed]}>
        <Image source={{ uri }} style={[styles.photoBox, { backgroundColor: theme.backgroundSelected }]} contentFit="cover" />
      </Pressable>

      {takenAt !== null && (
        <View>
          <ThemedText type="smallBold">{dateLabel(takenAt)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {timeLabel(takenAt)}
          </ThemedText>
        </View>
      )}

      <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [pressed && styles.pressed]}>
        <ThemedText type="smallBold" themeColor="primaryDeep">
          Replace
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function AreaScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const areaId = Number(id);

  const [area, setArea] = useState<AreaRow | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => {
    async function load() {
      setArea(await getArea(db, areaId));
    }

    load();
  }, [db, areaId]);

  async function savePhoto(slot: Slot, asset: ImagePicker.ImagePickerAsset) {
    try {
      await setAreaPhoto(db, areaId, slot, asset.uri, takenAtFromExif(asset.exif));
      setArea(await getArea(db, areaId));
    } catch {
      Alert.alert('Could not save the photo', 'Something went wrong. Please try again.');
    }
  }

  async function takePhoto(slot: Slot) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access is off', 'Turn it on in Settings to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: PHOTO_QUALITY, exif: true });
    if (result.canceled || result.assets === null) {
      return;
    }
    await savePhoto(slot, result.assets[0]);
  }

  async function chooseFromLibrary(slot: Slot) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access is off', 'Turn it on in Settings to choose a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: PHOTO_QUALITY, exif: true });
    if (result.canceled || result.assets === null) {
      return;
    }
    await savePhoto(slot, result.assets[0]);
  }

  async function saveNotes(value: string) {
    if (area !== null) {
      const trimmed = value.trim();
      if (trimmed !== area.notes) {
        await updateAreaNotes(db, areaId, trimmed);
        setArea({ ...area, notes: trimmed });
      }
    }
    setEditingNotes(false);
  }

  // Deleting is never Pro — removing your own data always works.
  function handleDelete() {
    Alert.alert('Delete this area?', 'Its before and after photos will be deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteArea(db, areaId);
          router.back();
        },
      },
    ]);
  }

  // Adding and replacing are Pro. Looking at saved photos never is.
  async function handleAddPhoto(slot: Slot) {
    if (!(await isPro(db))) {
      Alert.alert('A Pro feature', 'Unlock Pro to add photos to your record.', [{ text: 'OK' }]);
      return;
    }

    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => takePhoto(slot) },
      { text: 'Choose from library', onPress: () => chooseFromLibrary(slot) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // Both photos go in the viewer, so a swipe compares Before with After.
  const viewerPhotos: string[] = [];
  const viewerLabels: string[] = [];
  if (area !== null && area.before_photo !== null) {
    viewerPhotos.push(vaultPhotoUri(area.before_photo));
    viewerLabels.push(area.before_taken_at === null ? 'Before' : 'Before · ' + dateLabel(area.before_taken_at));
  }
  if (area !== null && area.after_photo !== null) {
    viewerPhotos.push(vaultPhotoUri(area.after_photo));
    viewerLabels.push(area.after_taken_at === null ? 'After' : 'After · ' + dateLabel(area.after_taken_at));
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [
                styles.backButton,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {area !== null && (
            <>
              <ThemedText style={styles.title}>{area.name}</ThemedText>

              <View style={styles.slots}>
                <PhotoSlot
                  label="Before"
                  fileName={area.before_photo}
                  takenAt={area.before_taken_at}
                  onAdd={() => handleAddPhoto('before')}
                  onView={(uri) => setViewerIndex(viewerPhotos.indexOf(uri))}
                />
                <PhotoSlot
                  label="After"
                  fileName={area.after_photo}
                  takenAt={area.after_taken_at}
                  onAdd={() => handleAddPhoto('after')}
                  onView={(uri) => setViewerIndex(viewerPhotos.indexOf(uri))}
                />
              </View>

              {/* Only while the After is missing — that's when someone might go out for it. */}
              {area.after_photo === null && (
                <View style={[styles.safetyPanel, { backgroundColor: theme.warningBackground }]}>
                  <MaterialCommunityIcons name="information-outline" size={20} color={theme.warning} />
                  <ThemedText style={styles.safetyText}>
                    Take after photos only once it's safe to go outside. Shoot from the ground, never from the roof.
                  </ThemedText>
                </View>
              )}

              {/* A modal, not inline — same reason as the document screen: the keyboard covered the field. */}
              <View style={styles.fieldBlock}>
                <ThemedText themeColor="textSecondary" style={styles.slotLabel}>
                  Notes
                </ThemedText>
                <Pressable
                  onPress={() => setEditingNotes(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit notes"
                  style={({ pressed }) => [
                    styles.fieldRow,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText themeColor={area.notes.length > 0 ? 'text' : 'textSecondary'} style={styles.fieldRowText}>
                    {area.notes.length > 0 ? area.notes : 'Add a note, like what changed or where you stood to take the photo.'}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary">Delete area</ThemedText>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          labels={viewerLabels}
          index={viewerIndex}
          onChangeIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      <NotesEditorModal visible={editingNotes} initialValue={area?.notes ?? ''} onSave={saveNotes} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    paddingTop: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  slots: {
    flexDirection: 'row',
    gap: 12,
  },
  slot: {
    flex: 1,
    gap: Spacing.two,
  },
  slotLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  photoBox: {
    height: 220,
    borderRadius: 14,
  },
  emptyBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.two,
  },
  addText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  safetyPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
  },
  safetyText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  fieldBlock: {
    gap: Spacing.two,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  fieldRowText: {
    flex: 1,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
