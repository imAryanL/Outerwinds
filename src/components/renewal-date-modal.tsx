// A sheet with a calendar for picking when a document renews. Same shape as NotesEditorModal.

import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  visible: boolean;
  initialValue: string | null;
  onSave: (value: Date) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function RenewalDateModal({ visible, initialValue, onSave, onRemove, onClose }: Props) {
  const theme = useTheme();
  const [draft, setDraft] = useState(new Date());

  // Opens on the saved date, or today if there isn't one or it has already passed.
  useEffect(() => {
    if (!visible) {
      return;
    }

    const today = new Date();
    if (initialValue !== null && new Date(initialValue) > today) {
      setDraft(new Date(initialValue));
    } else {
      setDraft(today);
    }
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel">
              <ThemedText style={[styles.headerButton, { color: theme.textSecondary }]}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.title}>Renews</ThemedText>
            <Pressable onPress={() => onSave(draft)} accessibilityRole="button" accessibilityLabel="Save">
              <ThemedText style={[styles.headerButton, styles.save, { color: theme.primaryDeep }]}>Save</ThemedText>
            </Pressable>
          </View>

          {/* A renewal date in the past makes no sense, so the calendar starts at today. */}
          <DateTimePicker
            value={draft}
            onValueChange={(event, date) => setDraft(date)}
            mode="date"
            display="inline"
            presentation="inline"
            minimumDate={new Date()}
            accentColor={theme.primaryDeep}
            style={styles.picker}
          />

          {initialValue !== null && (
            <Pressable onPress={onRemove} accessibilityRole="button" style={styles.removeRow}>
              <ThemedText themeColor="textSecondary">Remove date</ThemedText>
            </Pressable>
          )}
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: "500",
  },
  headerButton: {
    fontSize: 17,
  },
  save: {
    fontWeight: "700",
  },
  picker: {
    marginHorizontal: Spacing.three,
  },
  removeRow: {
    alignItems: "center",
    paddingVertical: Spacing.four,
  },
});
