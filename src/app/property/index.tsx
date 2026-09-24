// Storm Property Record — every area, with a small Before and After photo each.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { vaultPhotoUri } from '@/db/documents';
import { getAreas, type AreaRow } from '@/db/property';
import { useExportPropertyPdf } from '@/hooks/use-export-property-pdf';
import { useTheme } from '@/hooks/use-theme';
import { isPro } from '@/lib/pro';

function photoStatus(area: AreaRow) {
  if (area.before_photo !== null && area.after_photo !== null) {
    return 'Before and after';
  }
  if (area.before_photo !== null) {
    return 'Before only';
  }
  if (area.after_photo !== null) {
    return 'After only';
  }
  return 'No photos yet';
}

// A dashed box until there's a photo.
function Thumb({ fileName }: { fileName: string | null }) {
  const theme = useTheme();

  if (fileName === null) {
    return <View style={[styles.thumb, styles.thumbEmpty, { borderColor: theme.textTertiary }]} />;
  }
  return <Image source={{ uri: vaultPhotoUri(fileName) }} style={styles.thumb} contentFit="cover" />;
}

export default function PropertyRecordScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [areas, setAreas] = useState<AreaRow[] | null>(null);
  const { working: exporting, exportPdf } = useExportPropertyPdf();

  // Adding is the Pro part. Viewing what's already saved never is.
  async function handleAddAreas() {
    if (!(await isPro(db))) {
      Alert.alert('A Pro feature', 'Unlock Pro to add areas to your record.', [{ text: 'OK' }]);
      return;
    }
    router.push('/property/pick-areas');
  }

  // Re-reads on every visit, so areas added on the pick screen show up on return.
  useFocusEffect(
    useCallback(() => {
      async function load() {
        setAreas(await getAreas(db));
      }

      load();
    }, [db])
  );

  const rows = [];
  for (const area of areas ?? []) {
    if (rows.length > 0) {
      rows.push(<View key={`divider-${area.id}`} style={[styles.divider, { backgroundColor: theme.border }]} />);
    }
    rows.push(
      <Pressable
        key={area.id}
        onPress={() => router.push(`/property/${area.id}`)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.rowText}>
          <ThemedText style={styles.rowTitle}>{area.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {photoStatus(area)}
          </ThemedText>
        </View>

        <Thumb fileName={area.before_photo} />
        <Thumb fileName={area.after_photo} />
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>
    );
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

          <View style={styles.intro}>
            <ThemedText style={styles.title}>Storm property record</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Dated before and after photos, stored on this phone.
            </ThemedText>
          </View>

          <View style={[styles.card, { borderColor: theme.border }]}>
            {rows.length > 0 ? (
              rows
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                No areas yet
              </ThemedText>
            )}
          </View>

          {/* The photos only live on this phone, and the phone is what a storm can wreck. */}
          {rows.length > 0 && (
            <Pressable
              onPress={exportPdf}
              disabled={exporting}
              accessibilityRole="button"
              style={({ pressed }) => [styles.exportRow, { borderColor: theme.border }, pressed && styles.pressed]}>
              <View style={[styles.exportIcon, { backgroundColor: theme.backgroundSelected }]}>
                <MaterialCommunityIcons name="file-pdf-box" size={22} color={theme.primaryDeep} />
              </View>
              <View style={styles.rowText}>
                <ThemedText style={styles.rowTitle}>Export as PDF</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {exporting ? 'Making your PDF…' : 'Keep a copy somewhere other than this phone'}
                </ThemedText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          )}

          <Pressable
            onPress={handleAddAreas}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.addRow,
              { backgroundColor: theme.primaryDeep },
              pressed && styles.pressed,
            ]}>
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            <ThemedText style={styles.addLabel}>Add areas</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  intro: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  thumbEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  exportIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 16,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.6,
  },
});
