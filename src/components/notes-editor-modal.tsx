// A full-screen sheet for editing notes, not an inline field — inline, the keyboard
// covered the input with no reliable way to scroll it back into view; a dedicated
// sheet sidesteps that entirely. Shared by the document detail screen and the
// add-document confirm step, so both edit notes the same way.

import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  initialValue: string;
  onSave: (value: string) => void;
};

export function NotesEditorModal({ visible, initialValue, onSave }: Props) {
  const theme = useTheme();
  const [draft, setDraft] = useState(initialValue);

  // Resets the draft to the current value each time the sheet opens, so a save on one
  // document can't leak into the next one it's opened for.
  useEffect(() => {
    if (visible) {
      setDraft(initialValue);
    }
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onSave(draft)}>
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Notes</ThemedText>
            <Pressable onPress={() => onSave(draft)} accessibilityRole="button" accessibilityLabel="Done">
              <ThemedText style={[styles.done, { color: theme.primaryDeep }]}>Done</ThemedText>
            </Pressable>
          </View>

          <TextInput value={draft} onChangeText={setDraft} autoFocus multiline style={[styles.input, { color: theme.text }]} />
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
  done: {
    fontSize: 17,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    paddingHorizontal: Spacing.four,
    textAlignVertical: "top",
  },
});
