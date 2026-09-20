// Onboarding screen 6 of 6 — reads back what the other screens collected, then saves it.
// This is the last screen, so all five dots are filled and the button says Finish setup.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HOME_TYPES } from '@/app/onboarding/location';
import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { OnboardingHeader, TOTAL_STEPS } from '@/components/onboarding/onboarding-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { saveChecklist } from '@/db/checklist';
import { saveHousehold } from '@/db/household';
import { saveInventory } from '@/db/inventory';
import { useTheme } from '@/hooks/use-theme';
import { itemApplies } from '@/lib/checklist-template';
import { formatPlace } from '@/lib/nws';

const CURRENT_STEP = 5;

// '1 adult' or '3 adults'. Every word this is used with just takes an s.
export function countLabel(count: number, word: string) {
  if (count === 1) {
    return '1 ' + word;
  }

  return count + ' ' + word + 's';
}

export default function SummaryScreen() {
  const theme = useTheme();
  const { draft } = useOnboardingDraft();

  // Opened by SQLiteProvider in the root layout.
  const db = useSQLiteContext();

  const [saving, setSaving] = useState(false);

  // The only place the app writes what onboarding collected.
  async function handleFinish() {
    // A fast double tap would otherwise run the save twice and navigate twice.
    if (saving) {
      return;
    }
    setSaving(true);

    await saveHousehold(db, draft);

    // Checklist first: the supply rows link to it.
    await saveChecklist(db, draft);

    // Screen 4's supplies, linked to the checklist items they stock.
    await saveInventory(db, draft);

    // replace, not push — onboarding is done, so the back gesture must not return into it.
    router.replace('/(tabs)');
  }

  // The name is optional on screen 2, so the greeting drops it rather than leaving a gap.
  let title = "You're all set.";
  if (draft.name !== '') {
    title = "You're all set, " + draft.name + '.';
  }

  // Zero kids and zero pets are left out rather than shown as '0 kids'.
  const householdParts = [countLabel(draft.adults, 'adult')];
  if (draft.kids > 0) {
    householdParts.push(countLabel(draft.kids, 'kid'));
  }
  if (draft.pets > 0) {
    householdParts.push(countLabel(draft.pets, 'pet'));
  }
  const householdValue = householdParts.join(', ');

  // The city only exists if the NWS lookup landed, so offline falls back to the ZIP itself.
  let homeValue = draft.zip;
  if (draft.point !== null) {
    homeValue = formatPlace(draft.point);
  }
  for (const home of HOME_TYPES) {
    if (home.id === draft.homeType) {
      homeValue = homeValue + ' · ' + home.label;
    }
  }

  // Going back and changing home type can leave a hidden pill still tapped, so it doesn't count.
  let ownedCount = 0;
  for (const id of draft.owned) {
    if (itemApplies(id, draft.homeType, draft.concerns)) {
      ownedCount = ownedCount + 1;
    }
  }

  // No denominator — there is no target number of supplies to own.
  let suppliesValue = 'Nothing marked yet';
  if (ownedCount > 0) {
    suppliesValue = countLabel(ownedCount, 'item') + ' already at home';
  }

  // Notifications left out: that answer lives in iOS, so a row could disagree with the phone.
  const sections = [
    { id: 'household', icon: 'account-group-outline', label: 'Household', value: householdValue },
    { id: 'home', icon: 'map-marker-outline', label: 'Home', value: homeValue },
    { id: 'supplies', icon: 'package-variant-closed', label: 'Supplies', value: suppliesValue },
  ] as const;

  const sectionBlocks = [];
  for (const section of sections) {
    // A divider before every block except the first, so the three read as one card.
    if (sectionBlocks.length > 0) {
      sectionBlocks.push(
        <View
          key={section.id + '-divider'}
          style={[styles.divider, { backgroundColor: theme.border }]}
        />
      );
    }

    sectionBlocks.push(
      <View key={section.id} style={styles.section}>
        <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSelected }]}>
          <MaterialCommunityIcons name={section.icon} size={22} color={theme.primaryDeep} />
        </View>

        <ThemedText style={styles.sectionLabel}>{section.label}</ThemedText>

        <ThemedText themeColor="textSecondary" style={styles.sectionValue}>
          {section.value}
        </ThemedText>
      </View>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <OnboardingHeader step={CURRENT_STEP} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary" style={styles.stepLabel}>
              Step {CURRENT_STEP} of {TOTAL_STEPS}
            </ThemedText>

            <ThemedText style={styles.title}>{title}</ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Here&apos;s what Outerwinds knows.
            </ThemedText>
          </View>

          {/* White surface with no border. A bordered white card means 'fill this in'
              everywhere else in the app, and there is nothing to fill in here. */}
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {sectionBlocks}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {/* No disabled styling — the save takes milliseconds, so a greyed-out state would
              only ever flicker. `disabled` is here to block a double tap, not to be seen. */}
          <Pressable
            onPress={handleFinish}
            disabled={saving}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primaryDeep },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText style={styles.buttonText}>Finish setup</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  content: {
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  stepLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    marginTop: Spacing.four,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
  },
  section: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  divider: {
    height: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  sectionLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  sectionValue: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  button: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
