// Screen 4 of 6 — supplies the user already owns, so the app doesn't open at 0%.
// Nothing here writes to the database; screen 6 saves everything at once.

import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { OnboardingHeader, TOTAL_STEPS } from '@/components/onboarding/onboarding-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { itemApplies } from '@/lib/checklist-template';
import { tap, tick } from '@/lib/haptics';

const CURRENT_STEP = 3;

// No icons or subtext, so chips fit two per line.
export const SUPPLY_SECTIONS = [
  {
    title: 'Water & food',
    items: [
      { id: 'water', label: 'Bottled water' },
      { id: 'food', label: 'Non-perishable food' },
      { id: 'can_opener', label: 'Manual can opener' },
    ],
  },
  {
    title: 'Power & light',
    items: [
      { id: 'flashlights', label: 'Flashlights' },
      { id: 'batteries', label: 'Batteries' },
      { id: 'radio', label: 'Battery or hand-crank radio' },
    ],
  },
  {
    title: 'Medical & documents',
    items: [
      { id: 'first_aid', label: 'First aid kit' },
      { id: 'medicines', label: 'Prescription medicines' },
      { id: 'cash', label: 'Cash' },
      { id: 'documents', label: 'Important documents' },
    ],
  },
  {
    title: 'Home & property',
    items: [
      { id: 'shutters', label: 'Storm shutters or plywood' },
      { id: 'sandbags', label: 'Sandbags' },
      { id: 'tarp', label: 'Heavy-duty tarp' },
      { id: 'tie_downs', label: 'Rope or tie-downs' },
    ],
  },
];

export default function SuppliesScreen() {
  const theme = useTheme();
  const { draft, updateDraft } = useOnboardingDraft();

  // Multi-select here, unlike the single home type on screen 3.
  function toggleItem(id: string) {
    tick();
    if (draft.owned.includes(id)) {
      updateDraft({ owned: draft.owned.filter((ownedId) => ownedId !== id) });
    } else {
      updateDraft({ owned: [...draft.owned, id] });
    }
  }

  // Two loops: one per section, one for its chips.
  const sectionBlocks = [];
  for (const section of SUPPLY_SECTIONS) {
    const chips = [];
    for (const item of section.items) {
      if (!itemApplies(item.id, draft.homeType, draft.concerns)) {
        continue;
      }

      const isOn = draft.owned.includes(item.id);
      chips.push(
        <Pressable
          key={item.id}
          onPress={() => toggleItem(item.id)}
          // The fill is the only visual cue now, so VoiceOver needs to be told separately.
          accessibilityState={{ selected: isOn }}
          style={({ pressed }) => [
            styles.chip,
            {
              borderColor: isOn ? theme.primary : theme.border,
              backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
            },
            pressed && styles.pressed,
          ]}>
          <ThemedText themeColor={isOn ? 'primaryDeep' : 'text'} style={styles.chipLabel}>
            {item.label}
          </ThemedText>
        </Pressable>
      );
    }

    // No heading for a section with nothing left in it.
    if (chips.length === 0) {
      continue;
    }

    sectionBlocks.push(
      <View key={section.title} style={styles.section}>
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
          {section.title}
        </ThemedText>

        <View style={styles.chips}>{chips}</View>
      </View>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <OnboardingHeader step={CURRENT_STEP} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary" style={styles.stepLabel}>
              Step {CURRENT_STEP} of {TOTAL_STEPS}
            </ThemedText>

            <ThemedText style={styles.title}>What do you already have?</ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
             Tap anything you already keep at home — most households are further along than they think.
            </ThemedText>
          </View>

          <View style={styles.sections}>{sectionBlocks}</View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              tap();
              router.push('/onboarding/notifications');
            }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primaryButton },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText style={styles.buttonText}>Continue</ThemedText>
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
  sections: {
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.6,
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
