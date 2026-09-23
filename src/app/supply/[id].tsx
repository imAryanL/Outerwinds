// One supply's detail screen. The brackets in the filename make /supply/3 arrive with id = "3".
// Sits outside the tabs, so it covers the tab bar while open.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Checkbox } from "@/app/(tabs)/checklist";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import { removeChecklistItem, setChecklistItemDone } from "@/db/checklist";
import {
  getInventoryItem,
  setExpiryDate,
  setInventoryQuantity,
  type InventoryItemRow,
} from "@/db/inventory";
import { useTheme } from "@/hooks/use-theme";
import { daysUntil, expiryLabel, isExpiringSoon } from "@/lib/expiry";
import { scheduleReminders } from "@/lib/reminders";
import { iconFor } from "@/lib/supply-icons";

// Only linked items have a target, and some have no unit (flashlights: just 3).
function targetLabel(item: InventoryItemRow) {
  if (item.target_qty === null) {
    return "No target — you either have one or you don't.";
  }

  if (item.unit === null) {
    return `Target for your household: ${item.target_qty}`;
  }

  return `Target for your household: ${item.target_qty} ${item.unit}`;
}

// Only these need replacing. A date on cash or a tarp would be inventing a fact.
const EXPIRABLE_TEMPLATE_IDS = ["water", "food", "batteries", "first_aid", "medicines"];

// Quick-pick spans instead of a date-picker library, so no native module.
const EXPIRY_CHOICES = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
];

// Same wording as before the move — only the scheduling code is shared now.
function scheduleExpiryReminders(id: number, name: string, expiresAt: string | null) {
  return scheduleReminders("expiry", id, expiresAt, {
    thirtyDayTitle: `${name} is due for replacing in 30 days`,
    thirtyDayBody: "Plan to restock or rotate it soon.",
    sevenDayTitle: `${name} is due for replacing in 7 days`,
    sevenDayBody: "Time to restock or rotate it.",
  });
}

export default function SupplyDetailScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  // Arrives as text from the address, so it's turned into a number.
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);

  // Null while loading, or for an id with no row.
  const [item, setItem] = useState<InventoryItemRow | null>(null);

  // Plain useEffect: unlike a tab, this screen is pushed fresh every time it opens.
  useEffect(() => {
    async function load() {
      setItem(await getInventoryItem(db, itemId));
    }

    load();
  }, [db, itemId]);

  // Reads the row back, so the screen always shows what the database holds.
  async function changeQuantity(delta: number) {
    if (item === null) {
      return;
    }

    await setInventoryQuantity(db, item.id, item.quantity + delta);
    setItem(await getInventoryItem(db, itemId));
  }

  // Binary items tick here, since their checklist row opens this screen.
  async function toggleDone() {
    if (item === null || item.checklist_item_id === null) {
      return;
    }

    await setChecklistItemDone(db, item.checklist_item_id, item.done !== 1);
    setItem(await getInventoryItem(db, itemId));
  }

  async function pickExpiry(months: number) {
    if (item === null) {
      return;
    }

    const date = new Date();
    date.setMonth(date.getMonth() + months);
    const expiresAt = date.toISOString();

    await setExpiryDate(db, item.id, expiresAt);
    await scheduleExpiryReminders(item.id, item.name, expiresAt);
    setItem(await getInventoryItem(db, itemId));
  }

  // Falls back to the checklist when there's no history (a deep link).
  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/checklist");
    }
  }

  function handleRemove() {
    if (item === null || item.checklist_item_id === null) {
      return;
    }
    const checklistItemId = item.checklist_item_id;

    Alert.alert(`Remove "${item.name}"?`, "It comes off your checklist and its reminders stop.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          // A null date just cancels both reminders.
          await scheduleExpiryReminders(item.id, item.name, null);
          await removeChecklistItem(db, checklistItemId);
          leave();
        },
      },
    ]);
  }

  const isCount = item !== null && item.target_qty !== null;
  // Water, food, and flashlights have targets and stay. Everything else can be removed.
  const canRemove = item !== null && item.target_qty === null && item.checklist_item_id !== null;
  const isExpirable = item !== null && EXPIRABLE_TEMPLATE_IDS.includes(item.template_id ?? "");
  const daysLeft = item?.expires_at != null ? daysUntil(item.expires_at, new Date()) : null;
  const expiringSoon = daysLeft !== null && isExpiringSoon(daysLeft);

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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

          {/* Nothing to draw until the row arrives. */}
          {item !== null && (
            <>
              {/* The item's own header: icon, name, category. */}
              <View style={styles.itemHeader}>
                <ThemedView type="backgroundSelected" style={styles.iconCircle}>
                  <MaterialCommunityIcons
                    name={iconFor(item.template_id)}
                    size={30}
                    color={theme.primary}
                  />
                </ThemedView>
                <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.category}
                </ThemedText>
              </View>

              {/* Count items get the stepper, binary items a done toggle. */}
              {isCount ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textTertiary" style={styles.cardLabel}>
                    ON HAND
                  </ThemedText>

                  <View style={styles.stepper}>
                    {/* Nothing below zero — you can't own less than none of something. */}
                    <Pressable
                      onPress={() => changeQuantity(-1)}
                      disabled={item.quantity === 0}
                      accessibilityRole="button"
                      accessibilityLabel="Remove one"
                      // 48 plus hitSlop clears Apple's 44pt minimum.
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.bump,
                        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                        item.quantity === 0 && styles.bumpDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <MaterialCommunityIcons
                        name="minus"
                        size={24}
                        color={theme.textSecondary}
                      />
                    </Pressable>

                    <ThemedText style={styles.quantity}>{item.quantity}</ThemedText>

                    {/* No ceiling — any cap would be a guess. */}
                    <Pressable
                      onPress={() => changeQuantity(1)}
                      accessibilityRole="button"
                      accessibilityLabel="Add one"
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.bump,
                        { backgroundColor: theme.primaryDeep, borderColor: theme.primaryDeep },
                        pressed && styles.pressed,
                      ]}>
                      <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  <ThemedText type="small" themeColor="textSecondary">
                    {targetLabel(item)}
                  </ThemedText>
                </ThemedView>
              ) : (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textTertiary" style={styles.cardLabel}>
                    STATUS
                  </ThemedText>

                  <Pressable
                    onPress={toggleDone}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.done === 1 }}
                    style={({ pressed }) => [styles.doneRow, pressed && styles.pressed]}>
                    <Checkbox checked={item.done === 1} />
                    <ThemedText>{item.done === 1 ? "Done" : "Mark as done"}</ThemedText>
                  </Pressable>
                </ThemedView>
              )}

              {/* Only for items that need replacing. Amber once it's close, never red. */}
              {isExpirable && (
                <ThemedView
                  type={expiringSoon ? "warningBackground" : "backgroundElement"}
                  style={styles.card}>
                  <ThemedText
                    type="small"
                    themeColor={expiringSoon ? "warning" : "textTertiary"}
                    style={styles.cardLabel}>
                    REPLACE BY
                  </ThemedText>

                  <ThemedText themeColor={expiringSoon ? "warning" : undefined}>
                    {daysLeft === null ? "Not set" : expiryLabel(daysLeft)}
                  </ThemedText>

                  <View style={styles.chipRow}>
                    {EXPIRY_CHOICES.map((choice) => (
                      <Pressable
                        key={choice.label}
                        onPress={() => pickExpiry(choice.months)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.chip,
                          { borderColor: theme.border },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText type="small">{choice.label}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ThemedView>
              )}

              {canRemove && (
                <Pressable
                  onPress={handleRemove}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Remove from checklist
                  </ThemedText>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
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
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  itemHeader: {
    alignItems: "center",
    gap: Spacing.two,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "500",
    textAlign: "center",
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
  },
  cardLabel: {
    letterSpacing: 1,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
  },
  bump: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bumpDisabled: {
    opacity: 0.35,
  },
  quantity: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "600",
    minWidth: 72,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    alignSelf: "stretch",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
