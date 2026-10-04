// The prep checklist, read from the database. Onboarding writes the starting rows.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TabTransition } from "@/components/tab-transition";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";
import {
  deleteCustomChecklistItem,
  getChecklist,
  setChecklistItemDone,
  type ChecklistItemRow,
} from "@/db/checklist";
import { setInventoryQuantity } from "@/db/inventory";
import { usePrintPlan } from "@/hooks/use-print-plan";
import { useTheme } from "@/hooks/use-theme";
import { groupByCategory } from "@/lib/checklist-template";
import { tap, tick, warn } from "@/lib/haptics";

// Exported — the supply detail screen reuses it for a binary item's done toggle.
export function Checkbox({ checked }: { checked: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.checkbox,
        { borderColor: theme.primary },
        checked && { backgroundColor: theme.primary },
      ]}
    >
      {checked && <ThemedText style={[styles.checkmark, { color: theme.onPrimary }]}>✓</ThemedText>}
    </View>
  );
}

// '7 / 25'. The unit lives on the detail screen, where there's room for it.
function countLabel(onHand: number, target: number | null) {
  return `${onHand} / ${target}`;
}

// Capped at 100 so an overstocked item doesn't run past the end of the track.
function fillPercent(onHand: number, target: number | null) {
  if (target === null || target === 0) {
    return 0;
  }

  return Math.min(100, Math.round((onHand / target) * 100));
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <ThemedView type="backgroundSelected" style={styles.barTrack}>
      <ThemedView type="primary" style={[styles.barFill, { width: `${percent}%` }]} />
    </ThemedView>
  );
}

// Linked items open their detail screen. Custom items tick in place, and only they get onDelete.
// The circle is its own tap, so a linked item can be finished without opening the detail screen.
function ChecklistRow({
  item,
  onToggle,
  onFillToTarget,
  onDelete,
}: {
  item: ChecklistItemRow;
  onToggle: () => void;
  onFillToTarget: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();

  const isCount = item.target_qty !== null;
  const isLinked = item.inventory_id !== null;
  const onHand = item.on_hand ?? 0;

  function handlePress() {
    if (isLinked) {
      router.push(`/supply/${item.inventory_id}`);
    } else {
      tick();
      onToggle();
    }
  }

  // A count item's circle only fills it up; undoing goes through the detail screen, so a
  // stray tap can't zero a real count.
  function handleCirclePress() {
    if (isCount && isLinked) {
      if (item.done === 1) {
        router.push(`/supply/${item.inventory_id}`);
      } else {
        tick();
        onFillToTarget();
      }
    } else {
      tick();
      onToggle();
    }
  }

  const a11yProps = isLinked
    ? { accessibilityRole: "button" as const }
    : {
        accessibilityRole: "checkbox" as const,
        accessibilityState: { checked: item.done === 1 },
      };

  return (
    <Pressable
      onPress={handlePress}
      {...a11yProps}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Pressable
        onPress={handleCirclePress}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done === 1 }}
        accessibilityLabel={item.name}
      >
        <Checkbox checked={item.done === 1} />
      </Pressable>

      <View style={styles.rowText}>
        <View style={styles.nameRow}>
          <ThemedText type="small" style={styles.nameText}>
            {item.name}
          </ThemedText>

          {isCount && (
            <ThemedView type="backgroundSelected" style={styles.pill}>
              <ThemedText type="small" themeColor="textSecondary">
                {countLabel(onHand, item.target_qty)}
              </ThemedText>
            </ThemedView>
          )}
        </View>

        {isCount && <ProgressBar percent={fillPercent(onHand, item.target_qty)} />}

        {!isCount && item.rationale && (
          <ThemedText type="small" themeColor="textSecondary">
            {item.rationale}
          </ThemedText>
        )}
      </View>

      {isLinked && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.textSecondary}
        />
      )}

      {/* Sits where linked rows show their chevron. Its own tap, so it never ticks the row. */}
      {onDelete && (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.name}`}
          hitSlop={10}
          style={({ pressed }) => [pressed && styles.rowPressed]}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={20}
            color={theme.textSecondary}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

// Category name on the left, "2/3" done on the right.
function CategoryHeader({ name, items }: { name: string; items: ChecklistItemRow[] }) {
  let checkedCount = 0;
  for (const item of items) {
    if (item.done === 1) {
      checkedCount = checkedCount + 1;
    }
  }

  const totalCount = items.length;

  return (
    <View style={styles.categoryHeader}>
      <ThemedText type="smallBold">{name}</ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {checkedCount}/{totalCount}
      </ThemedText>
    </View>
  );
}

export default function ChecklistScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  // Null until the read comes back, so an empty list never flashes first.
  const [checklist, setChecklist] = useState<ChecklistItemRow[] | null>(null);

  // The tab stays mounted, so a plain useEffect would miss counts changed on the detail screen.
  useFocusEffect(
    useCallback(() => {
      async function load() {
        setChecklist(await getChecklist(db));
      }

      load();
    }, [db]),
  );

  // Write, then read the list back so the screen matches the database.
  async function toggleItem(item: ChecklistItemRow) {
    await setChecklistItemDone(db, item.id, item.done !== 1);
    setChecklist(await getChecklist(db));
  }

  // The done tick follows on its own: setInventoryQuantity ticks the item at its target.
  async function fillToTarget(item: ChecklistItemRow) {
    if (item.inventory_id === null || item.target_qty === null) {
      return;
    }

    await setInventoryQuantity(db, item.inventory_id, item.target_qty);
    setChecklist(await getChecklist(db));
  }

  const { working: printing, print } = usePrintPlan();

  function confirmDelete(item: ChecklistItemRow) {
    Alert.alert(`Delete "${item.name}"?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          warn();
          await deleteCustomChecklistItem(db, item.id);
          setChecklist(await getChecklist(db));
        },
      },
    ]);
  }

  const sections = [];
  for (const category of groupByCategory(checklist ?? [])) {
    const rows = [];
    for (const item of category.items) {
      // A divider before every row but the first.
      if (rows.length > 0) {
        rows.push(
          <View
            key={`divider-${item.id}`}
            style={[styles.rowDivider, { backgroundColor: theme.border }]}
          />,
        );
      }

      let onDelete: (() => void) | undefined = undefined;
      if (item.is_custom === 1) {
        onDelete = () => confirmDelete(item);
      }

      rows.push(
        <ChecklistRow
          key={item.id}
          item={item}
          onToggle={() => toggleItem(item)}
          onFillToTarget={() => fillToTarget(item)}
          onDelete={onDelete}
        />,
      );
    }

    sections.push(
      <View key={category.name} style={styles.categorySection}>
        <CategoryHeader name={category.name} items={category.items} />
        <View style={[styles.categoryCard, { borderColor: theme.border }]}>
          {rows}
        </View>
      </View>,
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <TabTransition>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              {/* Add lives up here so it's in reach however far the list scrolls. */}
              <View style={styles.titleRow}>
                <ThemedText style={styles.headerTitle}>Prep checklist</ThemedText>
                <Pressable
                  onPress={() => {
                    tap();
                    router.push("/add-item");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add item"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.addButton,
                    { backgroundColor: theme.primaryButton },
                    pressed && styles.rowPressed,
                  ]}
                >
                  <MaterialCommunityIcons name="plus-thick" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Tailored to your household
              </ThemedText>
            </View>

            {sections}

            {/* Sits under the list because that's the moment you want it — looking at
                what's left and about to go shopping. Same row for everyone: Pro builds
                the PDF, free sees the unlock prompt — this is the best place in the app
                to learn Pro exists. */}
            <Pressable
              onPress={() => {
                tap();
                print();
              }}
              disabled={printing}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.addRow,
                styles.printRow,
                styles.filledRow,
                { backgroundColor: theme.primaryButton },
                pressed && styles.rowPressed,
              ]}
            >
              <MaterialCommunityIcons name="printer-outline" size={20} color="#FFFFFF" />
              <ThemedText type="small" style={styles.printRowText}>
                {printing ? "Making your plan…" : "Print my plan"}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </TabTransition>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Filled, since this one does something. Smaller than the gear on Home, which only navigates.
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryCard: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "500",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "700",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
  rowText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    flex: 1,
  },
  pill: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  barTrack: {
    height: 8,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },
  barFill: {
    height: "100%",
    borderRadius: 8,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 16,
  },
  // A gap before this one row, so it doesn't read as glued to Add item.
  printRow: {
    marginTop: 12,
  },
  printRowText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // addRow's border is meant for an outlined button — a filled one needs none.
  filledRow: {
    borderWidth: 0,
  },
});
