// Adds a document to the vault. Two steps in one screen: pick a category and photos,
// then review the photos and confirm a title.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NotesEditorModal } from "@/components/notes-editor-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import { saveDocument } from "@/db/documents";
import { useTheme } from "@/hooks/use-theme";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

type Step = "picker" | "confirm";

// Full camera quality is far more than a document photo needs.
const PHOTO_QUALITY = 0.6;

export default function AddDocumentScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  // Screen width minus scrollContent's side padding. If it's off, paging stops mid-photo.
  const pageWidth = Math.min(useWindowDimensions().width, MaxContentWidth) - Spacing.four * 2;
  const pageHeight = pageWidth * 0.75;

  const [step, setStep] = useState<Step>("picker");
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0].label);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photoScrollRef = useRef<ScrollView>(null);

  // Keeps the scroll position on the current page after a photo is removed.
  useEffect(() => {
    photoScrollRef.current?.scrollTo({ x: page * pageWidth, animated: false });
  }, [page, pageWidth]);

  // Falls back to the Documents tab when there's no history (a deep link).
  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/documents");
    }
  }

  // On the confirm step, back means "pick a different photo," not "leave the flow."
  function handleBack() {
    if (step === "confirm") {
      setStep("picker");
      return;
    }
    leave();
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPermissionNotice("Camera access is off — turn it on in Settings to take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: PHOTO_QUALITY });
    if (result.canceled || result.assets === null) {
      return;
    }

    startConfirming(result.assets.map((asset) => asset.uri));
  }

  async function handleChooseFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionNotice("Photo access is off — turn it on in Settings to choose one.");
      return;
    }

    // Multiple selection so front-and-back of a card can be added in one pass.
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: PHOTO_QUALITY,
      allowsMultipleSelection: true,
    });
    if (result.canceled || result.assets === null) {
      return;
    }

    startConfirming(result.assets.map((asset) => asset.uri));
  }

  function startConfirming(uris: string[]) {
    setPhotoUris(uris);
    setPage(0);
    setTitle(category); // starts as the category name, renamed in one tap
    setNotes("");
    setPermissionNotice(null);
    setStep("confirm");
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  }

  // Only offered with 2+ photos. With one left, Back already means "pick again."
  function handleRemovePhoto() {
    const remaining = [];
    for (let i = 0; i < photoUris.length; i++) {
      if (i !== page) {
        remaining.push(photoUris[i]);
      }
    }
    setPhotoUris(remaining);

    // Removing the last photo would leave page pointing past the end.
    if (page > remaining.length - 1) {
      setPage(remaining.length - 1);
    }
  }

  async function handleSave() {
    if (title.trim().length === 0 || saving) {
      return;
    }

    setSaving(true);
    await saveDocument(db, title.trim(), category, photoUris, notes.trim());
    leave();
  }

  const categoryRows = [];
  for (const option of DOCUMENT_CATEGORIES) {
    const isOn = category === option.label;
    categoryRows.push(
      <Pressable
        key={option.id}
        onPress={() => setCategory(option.label)}
        accessibilityRole="radio"
        accessibilityState={{ selected: isOn }}
        style={({ pressed }) => [
          styles.optionRow,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}>
        <ThemedView type="backgroundElement" style={styles.optionIcon}>
          <MaterialCommunityIcons name={option.icon} size={18} color={theme.primary} />
        </ThemedView>

        <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>

        {isOn ? (
          <View style={[styles.radioFilled, { backgroundColor: theme.primary }]}>
            <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />
          </View>
        ) : (
          <View style={[styles.radioEmpty, { borderColor: theme.border }]} />
        )}
      </Pressable>,
    );
  }

  const photoPages = [];
  const dots = [];
  for (let i = 0; i < photoUris.length; i++) {
    photoPages.push(
      <Image
        key={photoUris[i]}
        source={{ uri: photoUris[i] }}
        style={{ width: pageWidth, height: pageHeight }}
        contentFit="cover"
      />,
    );
    dots.push(
      <View
        key={photoUris[i]}
        style={[styles.dot, { backgroundColor: i === page ? theme.primary : theme.border }]}
      />,
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.backButton,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.textSecondary} />
          </Pressable>

          {step === "picker" ? (
            <>
              <View style={styles.header}>
                <ThemedText style={styles.title}>Add document</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Choose a category, then take or choose a photo
                </ThemedText>
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textTertiary" style={styles.fieldLabel}>
                  CATEGORY
                </ThemedText>
                <View style={styles.optionRows}>{categoryRows}</View>
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textTertiary" style={styles.fieldLabel}>
                  ADD A PHOTO
                </ThemedText>

                <View style={styles.optionRows}>
                  <Pressable
                    onPress={handleTakePhoto}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.photoSourceRow,
                      { backgroundColor: theme.primaryDeep },
                      pressed && styles.pressed,
                    ]}>
                    <MaterialCommunityIcons name="camera" size={22} color="#FFFFFF" />
                    <ThemedText style={styles.photoSourceLabel}>Take Photo</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={handleChooseFromLibrary}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.photoSourceRow,
                      { backgroundColor: theme.primaryDeep },
                      pressed && styles.pressed,
                    ]}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={22} color="#FFFFFF" />
                    <ThemedText style={styles.photoSourceLabel}>Choose from Library</ThemedText>
                  </Pressable>
                </View>

                {permissionNotice !== null && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {permissionNotice}
                  </ThemedText>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.photoBlock}>
                <View style={[styles.confirmPhoto, { width: pageWidth, height: pageHeight }]}>
                  <ScrollView
                    ref={photoScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleScrollEnd}>
                    {photoPages}
                  </ScrollView>
                </View>

                {photoUris.length > 1 && (
                  <View style={styles.photoControls}>
                    <View style={styles.dots}>{dots}</View>

                    <Pressable
                      onPress={handleRemovePhoto}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${page + 1} of ${photoUris.length}`}
                      hitSlop={8}
                      style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        Remove
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textTertiary" style={styles.fieldLabel}>
                  TITLE
                </ThemedText>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                  returnKeyType="done"
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textTertiary" style={styles.fieldLabel}>
                  NOTES
                </ThemedText>
                <Pressable
                  onPress={() => setEditingNotes(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit notes"
                  style={({ pressed }) => [
                    styles.notesRow,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="default" themeColor={notes.length > 0 ? "text" : "textSecondary"} style={styles.notesRowText}>
                    {notes.length > 0 ? notes : "Add a note here like important information, a phone number, anything worth having handy."}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.categoryDisplay}>
                <MaterialCommunityIcons
                  name={DOCUMENT_CATEGORIES.find((entry) => entry.label === category)?.icon ?? "file-document-outline"}
                  size={16}
                  color={theme.textSecondary}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {category}
                </ThemedText>
              </View>
            </>
          )}
        </ScrollView>

        {step === "confirm" && (
          <View style={styles.footer}>
            <Pressable
              onPress={handleSave}
              disabled={title.trim().length === 0 || saving}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: theme.primaryDeep },
                pressed && styles.buttonPressed,
              ]}>
              <ThemedText style={styles.saveButtonText}>Save</ThemedText>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <NotesEditorModal
        visible={editingNotes}
        initialValue={notes}
        onSave={(value) => {
          setNotes(value.trim());
          setEditingNotes(false);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    gap: Spacing.half,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "500",
  },
  field: {
    gap: Spacing.two,
  },
  fieldLabel: {
    letterSpacing: 0.5,
  },
  optionRows: {
    gap: Spacing.two,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: 2,
    borderRadius: 14,
    padding: Spacing.three,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
  },
  photoSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: 14,
    padding: Spacing.three,
  },
  photoSourceLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  radioFilled: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBlock: {
    gap: Spacing.three,
  },
  confirmPhoto: {
    borderRadius: 16,
    overflow: "hidden",
  },
  photoControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
    fontFamily: Fonts.serif,
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  notesRowText: {
    flex: 1,
  },
  categoryDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  saveButton: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
