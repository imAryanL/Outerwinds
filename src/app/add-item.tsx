// Adds an item the user keeps that isn't on the standard list. Reached from the "+ Add
// item" row at the bottom of the checklist. Pushes over the tabs like the supply detail
// screen. Everything added here is a plain tick — no target, no count.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import { addCustomChecklistItem } from "@/db/checklist";
import { useTheme } from "@/hooks/use-theme";
import { CHECKLIST_CATEGORIES } from "@/lib/checklist-template";

// The template's three sections plus a catch-all, so a custom item always has a section
// the checklist already draws.
const CATEGORIES = [...CHECKLIST_CATEGORIES, "Other"];

export default function AddItemScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canAdd = name.trim().length > 0 && category !== null;

  // Normally pops back to the checklist. The fallback covers the screen being opened as
  // the first route (a deep link), where there's no history to pop.
  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/checklist");
    }
  }

  async function handleAdd() {
    if (!canAdd || saving) {
      return;
    }

    setSaving(true);
    await addCustomChecklistItem(db, name.trim(), category!);
    leave();
  }

  const categoryRows = [];
  for (const option of CATEGORIES) {
    const isOn = category === option;
    categoryRows.push(
      <Pressable
        key={option}
        onPress={() => setCategory(option)}
        accessibilityRole="radio"
        accessibilityState={{ selected: isOn }}
        style={({ pressed }) => [
          styles.categoryRow,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}>
        <ThemedText themeColor={isOn ? "primaryDeep" : "text"} style={styles.categoryLabel}>
          {option}
        </ThemedText>

        {isOn && (
          <MaterialCommunityIcons name="check" size={18} color={theme.primaryDeep} />
        )}
      </Pressable>,
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={styles.header}>
            <Pressable
              onPress={leave}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [
                styles.backButton,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <MaterialCommunityIcons
                name="chevron-left"
                size={24}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>

          <ThemedText style={styles.title}>Add an item</ThemedText>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Name
            </ThemedText>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Portable phone charger"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              returnKeyType="done"
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />
          </View>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Category
            </ThemedText>

            <View style={styles.categoryRows}>{categoryRows}</View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleAdd}
            disabled={!canAdd}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: canAdd ? theme.primaryButton : theme.border },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText
              style={[styles.buttonText, canAdd ? null : { color: theme.textSecondary }]}>
              Add to checklist
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    paddingTop: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
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
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
  categoryRows: {
    gap: Spacing.two,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  button: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
