// One document's screen — the photo is the hero, with title, notes and renewal below.

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
import { RenewalDateModal } from "@/components/renewal-date-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  deleteDocument,
  getDocument,
  getPhotoUris,
  setRenewalDate,
  updateDocumentNotes,
  updateDocumentTitle,
  type DocumentRow,
} from "@/db/documents";
import { useExportDocumentPdf } from "@/hooks/use-export-document-pdf";
import { useTheme } from "@/hooks/use-theme";
import { daysUntil, isExpiringSoon } from "@/lib/expiry";
import { isPro } from "@/lib/pro";
import { scheduleReminders } from "@/lib/reminders";

// 'September 3' — spelled out here, unlike the list row's shorter 'Sep 3'.
function addedLabel(createdAt: string) {
  const date = new Date(createdAt);
  return `Added ${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

// 'Renews June 1, 2027', or a countdown in the last 30 days.
function renewalLabel(renewsAt: string, daysLeft: number) {
  const date = new Date(renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (daysLeft > 30) {
    return `Renews ${date}`;
  }
  if (daysLeft > 1) {
    return `Renews in ${daysLeft} days · ${date}`;
  }
  if (daysLeft === 1) {
    return `Renews tomorrow · ${date}`;
  }
  if (daysLeft === 0) {
    return "Renews today";
  }
  return `Renewal was due ${date}`;
}

// Both reminders name the document, e.g. "Flood insurance renews in 30 days".
function scheduleRenewalReminders(id: number, title: string, renewsAt: string | null) {
  return scheduleReminders("renewal", id, renewsAt, {
    thirtyDayTitle: `${title} renews in 30 days`,
    thirtyDayBody: "Renew it before it lapses.",
    sevenDayTitle: `${title} renews in 7 days`,
    sevenDayBody: "Renew it before it lapses.",
  });
}

export default function DocumentDetailScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const photoWidth = Math.min(useWindowDimensions().width, MaxContentWidth);
  // 4:3 — a full square left too much empty space below.
  const heroHeight = photoWidth * 0.75;

  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = Number(id);

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [page, setPage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingRenewal, setEditingRenewal] = useState(false);
  const heroScrollRef = useRef<ScrollView>(null);
  const { working: exporting, exportPdf } = useExportDocumentPdf(documentId);

  useEffect(() => {
    async function load() {
      setDoc(await getDocument(db, documentId));
    }

    load();
  }, [db, documentId]);

  // Keeps the hero in sync when the full-screen viewer changes the page.
  useEffect(() => {
    heroScrollRef.current?.scrollTo({ x: page * photoWidth, animated: false });
  }, [page, photoWidth]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / photoWidth));
  }

  // The fallback covers a deep link, where there's no history to pop.
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

    const photos = getPhotoUris(doc);
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

  // Fires on the keyboard's Done and on tapping away, so no confirm/cancel buttons.
  async function saveTitle() {
    if (doc !== null) {
      const trimmed = titleDraft.trim();
      if (trimmed.length > 0 && trimmed !== doc.title) {
        await updateDocumentTitle(db, documentId, trimmed);
        await scheduleRenewalReminders(documentId, trimmed, doc.renews_at);
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

  // Setting a date is Pro; seeing one never is.
  async function startEditingRenewal() {
    if (!(await isPro(db))) {
      // Stands in for the real paywall until RevenueCat exists.
      Alert.alert("A Pro feature", "Unlock Pro to get reminders before this document needs renewing.", [{ text: "OK" }]);
      return;
    }
    setEditingRenewal(true);
  }

  async function saveRenewal(date: Date) {
    if (doc !== null) {
      // 9 AM, so the reminders arrive in the morning rather than at midnight.
      const renewal = new Date(date);
      renewal.setHours(9, 0, 0, 0);
      const renewsAt = renewal.toISOString();

      await setRenewalDate(db, documentId, renewsAt);
      await scheduleRenewalReminders(documentId, doc.title, renewsAt);
      setDoc({ ...doc, renews_at: renewsAt });
    }
    setEditingRenewal(false);
  }

  async function removeRenewal() {
    if (doc !== null) {
      await setRenewalDate(db, documentId, null);
      await scheduleRenewalReminders(documentId, doc.title, null);
      setDoc({ ...doc, renews_at: null });
    }
    setEditingRenewal(false);
  }

  // Photos are deleted too, with no trash to recover from.
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

  const photos: string[] = doc !== null ? getPhotoUris(doc) : [];

  // Amber from 30 days out, same as a supply that's due for replacing.
  let renewalText = "Add a renewal date";
  let renewalColor: string = theme.textSecondary;
  if (doc !== null && doc.renews_at !== null) {
    const daysLeft = daysUntil(doc.renews_at, new Date());
    renewalText = renewalLabel(doc.renews_at, daysLeft);
    renewalColor = isExpiringSoon(daysLeft) ? theme.warning : theme.text;
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* Narrower edge-swipe zone, so it stops eating the back button's taps. */}
      <Stack.Screen options={{ gestureResponseDistance: { start: 12 } }} />

      {/* Its own row above the photo, so the photo doesn't bleed under the buttons. */}
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
              <View
                style={{
                  width: photoWidth,
                  height: heroHeight,
                  alignSelf: "center",
                  backgroundColor: theme.backgroundElement,
                }}>
                <ScrollView
                  ref={heroScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleScrollEnd}>
                  {photos.map((uri) => (
                    <Pressable key={uri} onPress={() => setViewerOpen(true)} accessibilityRole="button" accessibilityLabel="View full screen">
                      <Image source={{ uri }} style={{ width: photoWidth, height: heroHeight }} contentFit="contain" />
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

                {/* A modal, not inline — inline, the keyboard covered the field. */}
                <View style={styles.fieldBlock}>
                  <ThemedText type="small" themeColor="textTertiary" style={styles.fieldLabel}>
                    NOTES
                  </ThemedText>

                  <Pressable
                    onPress={startEditingNotes}
                    accessibilityRole="button"
                    accessibilityLabel="Edit notes"
                    style={({ pressed }) => [
                      styles.fieldRow,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="default" themeColor={doc.notes.length > 0 ? "text" : "textSecondary"} style={styles.fieldRowText}>
                      {doc.notes.length > 0
                        ? doc.notes
                        : "Add a note here like important information, a phone number, anything worth having handy."}
                    </ThemedText>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.fieldBlock}>
                  <ThemedText type="small" themeColor="textTertiary" style={styles.fieldLabel}>
                    RENEWS
                  </ThemedText>

                  <Pressable
                    onPress={startEditingRenewal}
                    accessibilityRole="button"
                    accessibilityLabel="Set renewal date"
                    style={({ pressed }) => [
                      styles.fieldRow,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="default" style={[styles.fieldRowText, { color: renewalColor }]}>
                      {renewalText}
                    </ThemedText>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>

                {/* Every photo in one file, unlike Share, which sends only the one on screen. */}
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
      <RenewalDateModal
        visible={editingRenewal}
        initialValue={doc?.renews_at ?? null}
        onSave={saveRenewal}
        onRemove={removeRenewal}
        onClose={() => setEditingRenewal(false)}
      />
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
  fieldBlock: {
    gap: Spacing.two,
  },
  fieldLabel: {
    letterSpacing: 0.5,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  fieldRowText: {
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
