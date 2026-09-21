// One document, opened by tapping a row on the Documents tab. Mirrors supply/[id].tsx's
// shape, but the photo itself is the hero — this is the first screen in the app where a
// real photo, not an icon, is what the user actually came to look at.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NotesEditorModal } from "@/components/notes-editor-modal";
import { PhotoViewer } from "@/components/photo-viewer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import { deleteDocument, getDocument, updateDocumentNotes, updateDocumentTitle, type DocumentRow } from "@/db/documents";
import { useExportDocumentPdf } from "@/hooks/use-export-document-pdf";
import { useTheme } from "@/hooks/use-theme";

// 'September 3' — spelled out here, unlike the list row's shorter 'Sep 3'.
function addedLabel(createdAt: string) {
  const date = new Date(createdAt);
  return `Added ${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

export default function DocumentDetailScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const photoWidth = Math.min(useWindowDimensions().width, MaxContentWidth);
  // A full square left too much empty space below the title/delete row on a real
  // screen — 4:3 gives the photo a proper hero size without dominating the page.
  const heroHeight = photoWidth * 0.75;

  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = Number(id);

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [page, setPage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const heroScrollRef = useRef<ScrollView>(null);
  const { working: exporting, exportPdf } = useExportDocumentPdf(documentId);

  useEffect(() => {
    async function load() {
      setDoc(await getDocument(db, documentId));
    }

    load();
  }, [db, documentId]);

  // Keeps the hero's own paging in sync when the full-screen viewer changes the page —
  // a no-op scroll when the hero caused the change itself.
  useEffect(() => {
    heroScrollRef.current?.scrollTo({ x: page * photoWidth, animated: false });
  }, [page, photoWidth]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / photoWidth));
  }

  // Normally pops back to the Documents tab. The fallback covers this screen being opened
  // as the first route (a deep link), where there's no history to pop — same guard
  // add-item.tsx already uses for the same reason.
  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/documents");
    }
  }

  async function handleShare() {
    if (doc === null) {
      return;
    }

    const photos: string[] = JSON.parse(doc.photo_uris);
    if (!(await Sharing.isAvailableAsync())) {
      return;
    }
    await Sharing.shareAsync(photos[page]);
  }

  function startEditingTitle() {
    if (doc === null) {
      return;
    }
    setTitleDraft(doc.title);
    setEditingTitle(true);
  }

  // Fires on both the keyboard's Done and tapping away — no separate confirm/cancel
  // buttons needed. Always exits edit mode, even when there's nothing worth saving.
  async function saveTitle() {
    if (doc !== null) {
      const trimmed = titleDraft.trim();
      if (trimmed.length > 0 && trimmed !== doc.title) {
        await updateDocumentTitle(db, documentId, trimmed);
        setDoc({ ...doc, title: trimmed });
      }
    }
    setEditingTitle(false);
  }

  function startEditingNotes() {
    if (doc === null) {
      return;
    }
    setEditingNotes(true);
  }

  // Unlike the title, an empty note is a valid save — it's how you clear one out.
  async function saveNotes(value: string) {
    if (doc !== null) {
      const trimmed = value.trim();
      if (trimmed !== doc.notes) {
        await updateDocumentNotes(db, documentId, trimmed);
        setDoc({ ...doc, notes: trimmed });
      }
    }
    setEditingNotes(false);
  }

  // Deleting removes the photo files too, with no trash to recover from — worth an
  // are-you-sure since this is the app's only delete flow that can't be undone.
  function handleDelete() {
    Alert.alert("Delete document?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDocument(db, documentId);
          leave();
        },
      },
    ]);
  }

  const photos: string[] = doc !== null ? JSON.parse(doc.photo_uris) : [];

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* The back button sits 16-56pt from the edge, inside the default 50pt edge-swipe
          zone — narrowing the zone stops it from eating the button's taps, without
          losing the swipe-back gesture itself. */}
      <Stack.Screen options={{ gestureResponseDistance: { start: 12 } }} />

      {/* A real row above the photo, not floating on top of it — so the photo starts
          below the buttons instead of bleeding under them. Back doesn't need doc to be
          loaded, so it's outside that check; Share does, so it stays gated. */}
      <SafeAreaView edges={["top"]}>
        <View style={styles.navBar}>
          <Pressable
            onPress={leave}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={theme.text} />
          </Pressable>

          {doc !== null && (
            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share"
              style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
              <MaterialCommunityIcons name="export-variant" size={19} color={theme.text} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} keyboardShouldPersistTaps="handled">
          {doc !== null && (
            <>
              <View style={{ width: photoWidth, height: heroHeight, alignSelf: "center" }}>
                <ScrollView
                  ref={heroScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleScrollEnd}>
                  {photos.map((uri) => (
                    <Pressable key={uri} onPress={() => setViewerOpen(true)} accessibilityRole="button" accessibilityLabel="View full screen">
                      <Image source={{ uri }} style={{ width: photoWidth, height: heroHeight }} contentFit="cover" />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {photos.length > 1 && (
                <View style={styles.dots}>
                  {photos.map((uri, index) => (
                    <View
                      key={uri}
                      style={[
                        styles.dot,
                        { backgroundColor: index === page ? theme.primary : theme.border },
                      ]}
                    />
                  ))}
                </View>
              )}

              <View style={styles.body}>
                <View style={styles.titleBlock}>
                  {editingTitle ? (
                    <TextInput
                      value={titleDraft}
                      onChangeText={setTitleDraft}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={saveTitle}
                      onBlur={saveTitle}
                      style={[styles.titleInput, { color: theme.text, borderColor: theme.border }]}
                    />
                  ) : (
                    <View style={styles.titleEditRow}>
                      <ThemedText style={styles.title}>{doc.title}</ThemedText>
                      <Pressable onPress={startEditingTitle} accessibilityRole="button" accessibilityLabel="Edit title" hitSlop={8}>
                        <MaterialCommunityIcons name="pencil-outline" size={22} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.metaBlock}>
                    <ThemedText type="default" themeColor="textSecondary">
                      Type: {doc.category}
                    </ThemedText>
                    <ThemedText type="default" themeColor="textSecondary">
                      {addedLabel(doc.created_at)}
                    </ThemedText>
                  </View>
                </View>

                {/* Opens the notes editor in its own modal (below) rather than inline —
                    inline, the keyboard covered it with no reliable way to scroll it back
                    into view; a dedicated sheet sidesteps that entirely. */}
                <View style={styles.notesBlock}>
                  <ThemedText type="small" themeColor="textTertiary" style={styles.notesLabel}>
                    NOTES
                  </ThemedText>

                  <Pressable
                    onPress={startEditingNotes}
                    accessibilityRole="button"
                    accessibilityLabel="Edit notes"
                    style={({ pressed }) => [
                      styles.notesRow,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="default" themeColor={doc.notes.length > 0 ? "text" : "textSecondary"} style={styles.notesRowText}>
                      {doc.notes.length > 0
                        ? doc.notes
                        : "Add a note here like important information, a phone number, anything worth having handy."}
                    </ThemedText>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>

                {/* Distinct from the Share button up top, which only sends whichever single
                    photo is on screen — this combines every photo into one file, the thing
                    worth sending an adjuster. Same filled-row treatment as "Print my plan". */}
                <Pressable
                  onPress={exportPdf}
                  disabled={exporting}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.exportRow,
                    { backgroundColor: theme.primaryDeep },
                    pressed && styles.pressed,
                  ]}>
                  <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.exportRowText}>
                    {exporting ? "Making your PDF…" : "Export as PDF"}
                  </ThemedText>
                </Pressable>

                <View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <Pressable
                    onPress={handleDelete}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.textSecondary} />
                    <ThemedText themeColor="textSecondary">Delete document</ThemedText>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {viewerOpen && photos.length > 0 && (
          <PhotoViewer photos={photos} index={page} onChangeIndex={setPage} onClose={() => setViewerOpen(false)} />
        )}
      </SafeAreaView>

      <NotesEditorModal visible={editingNotes} initialValue={doc?.notes ?? ""} onSave={saveNotes} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: Spacing.three,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // A normal top-to-bottom flow, not flex/space-between — the notes field means there's
  // usually real content to fill this space now instead of needing a layout trick to hide
  // that there wasn't any.
  body: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
    gap: Spacing.four,
  },
  titleBlock: {
    gap: Spacing.three,
  },
  metaBlock: {
    gap: Spacing.two,
  },
  notesBlock: {
    gap: Spacing.two,
  },
  notesLabel: {
    letterSpacing: 0.5,
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
  titleEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "500",
  },
  titleInput: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 22,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  exportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: 14,
    paddingVertical: Spacing.three,
  },
  exportRowText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
