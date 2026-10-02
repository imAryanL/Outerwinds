// One '− 2 +' counting row: a label, a short hint under it, and a stepper on the right.
//
// Written once and used for adults, children and pets, so the three rows can never drift
// apart from each other.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tick } from '@/lib/haptics';

// Nobody has a hundred people in the house, and an absurd number would only produce an
// absurd shopping list. The cap keeps the targets believable.
const MAX_PER_ROW = 12;

type StepperRowProps = {
  label: string;
  /** The short line under the label, explaining what to count. */
  hint: string;
  value: number;
  onChange: (next: number) => void;
  /** The lowest this row is allowed to go — 1 for adults, 0 for the rest. */
  min: number;
};

export function StepperRow({ label, hint, value, onChange, min }: StepperRowProps) {
  const theme = useTheme();

  const canGoDown = value > min;
  const canGoUp = value < MAX_PER_ROW;

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.rowHint}>
          {hint}
        </ThemedText>
      </View>

      <View style={styles.stepper}>
        <Pressable
          onPress={() => {
            tick();
            onChange(value - 1);
          }}
          disabled={!canGoDown}
          // The circle is drawn at 36 but hitSlop stretches the touch area 6px in every
          // direction, so the real target is 48 — above Apple's 44pt minimum without
          // making the button look heavy.
          hitSlop={6}
          style={({ pressed }) => [
            styles.bump,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            !canGoDown && styles.bumpDisabled,
            pressed && styles.pressed,
          ]}>
          <MaterialCommunityIcons name="minus" size={20} color={theme.textSecondary} />
        </Pressable>

        <ThemedText style={styles.count}>{value}</ThemedText>

        <Pressable
          onPress={() => {
            tick();
            onChange(value + 1);
          }}
          disabled={!canGoUp}
          hitSlop={6}
          style={({ pressed }) => [
            styles.bump,
            { backgroundColor: theme.primaryButton, borderColor: theme.primaryButton },
            !canGoUp && styles.bumpDisabled,
            pressed && styles.pressed,
          ]}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  rowText: {
    flex: 1, // takes the leftover width, pushing the stepper to the right edge
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bump: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bumpDisabled: {
    opacity: 0.35, // dimmed rather than hidden, so the row never changes shape
  },
  count: {
    fontSize: 19,
    fontWeight: '600',
    minWidth: 18, // holds its width from 1 to 12, so nothing shifts as the number changes
    textAlign: 'center',
    fontVariant: ['tabular-nums'], // every digit the same width
  },
  pressed: {
    opacity: 0.6,
  },
});
