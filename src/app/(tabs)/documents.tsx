// The document vault, grouped into the four fixed categories. Unlike the checklist, every
// category always shows — even empty ones — since there's no data to derive them from.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";
import { getDocuments, type DocumentRow } from "@/db/documents";
import { useTheme } from "@/hooks/use-theme";
import { DOCUMENT_CATEGORIES, iconForCategory } from "@/lib/document-categories";
import { FREE_DOCUMENT_LIMIT, isPro } from "@/lib/pro";

// 'Added Sep 3' — same short format everywhere a document shows its date.
function addedLabel(createdAt: string) {
  const date = new Date(createdAt);
  return `Added ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// Split out from the loop below so it can call useTheme() itself — hooks can't be
// called per-iteration inside another component's render.
function DocumentRowView({ doc }: { doc: DocumentRow }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/document/${doc.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <ThemedView type="backgroundSelected" style={styles.iconSwatch}>
        <MaterialCommunityIcons name={iconForCategory(doc.category)} size={22} color={theme.primary} />
      </ThemedView>

      <View style={styles.rowText}>
        <ThemedText type="small" style={styles.rowTitle}>
          {doc.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {addedLabel(doc.created_at)}
        </ThemedText>
      </View>

      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

export default function DocumentsScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);

  // Free caps at FREE_DOCUMENT_LIMIT documents, not photos — a 6-page policy is one.
  // Checked here, before the picker flow starts, so a free user never fills out a
  // whole add flow only to be blocked on save.
  async function handleAddDocument() {
    const count = documents?.length ?? 0;
    if (count >= FREE_DOCUMENT_LIMIT && !(await isPro(db))) {
      Alert.alert(
        "A Pro feature",
        `Unlock Pro to save more than ${FREE_DOCUMENT_LIMIT} documents.`,
        [{ text: "OK" }]
      );
      return;
    }
    router.push("/add-document");
  }

  // useFocusEffect (not useEffect) re-runs every time this tab is navigated back to, not
  // just on first mount — needed so a document added or deleted elsewhere shows up here
  // without switching tabs twice. useCallback keeps the function reference stable so it
  // doesn't re-fire on every render.
  useFocusEffect(
    useCallback(() => {
      async function load() {
        setDocuments(await getDocuments(db));
      }

      load();
    }, [db])
  );

  // Two passes: one category section per fixed category (always all 4, even empty ones),
  // and inside each, one row per document with a divider between rows — but never before
  // the first one, which is what the rows.length check is for.
  const sections = [];
  for (const category of DOCUMENT_CATEGORIES) {
    const docsInCategory = (documents ?? []).filter((doc) => doc.category === category.label);

    const rows = [];
    for (const doc of docsInCategory) {
      if (rows.length > 0) {
        rows.push(<View key={`divider-${doc.id}`} style={[styles.rowDivider, { backgroundColor: theme.border }]} />);
      }
      rows.push(<DocumentRowView key={doc.id} doc={doc} />);
    }

    sections.push(
      <View key={category.id} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <ThemedText type="smallBold">{category.label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {docsInCategory.length}
          </ThemedText>
        </View>

        <View style={[styles.categoryCard, { borderColor: theme.border }]}>
          {docsInCategory.length > 0 ? (
            rows
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Nothing saved here yet
            </ThemedText>
          )}
        </View>
      </View>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>Documents</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Stored on your phone, not the cloud
            </ThemedText>
          </View>

          {sections}

          <Pressable
            onPress={handleAddDocument}
            accessibilityRole="button"
            testID="add-document-button"
            style={({ pressed }) => [
              styles.addRow,
              { backgroundColor: theme.primaryDeep },
              pressed && styles.rowPressed,
            ]}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            <ThemedText style={styles.addLabel}>Add document</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginTop: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "500",
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryCard: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowDivider: {
    height: 1,
  },
  iconSwatch: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontWeight: "500",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    padding: 16,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
