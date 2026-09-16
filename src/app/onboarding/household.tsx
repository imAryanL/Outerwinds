// Onboarding screen 2 of 6 — who lives in the household. Sets the checklist's target quantities.
// Nothing writes to the database here; screen 6 saves everything at once.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { OnboardingHeader, TOTAL_STEPS } from '@/components/onboarding/onboarding-header';
import { StepperRow } from '@/components/onboarding/stepper-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { computeTargets, PLANNING_DAYS } from '@/lib/targets';

// Welcome isn't a step, so this is 1 of 5.
const CURRENT_STEP = 1;

// Three only. A generator chip is cut from v1. Exported so the Settings edit screen asks
// the same three rather than keeping its own copy of the labels.
export const CONCERNS = [
  { id: 'prescriptions', label: 'Daily prescriptions', icon: 'pill' },
  { id: 'infant', label: 'Infant or formula', icon: 'baby-bottle-outline' },
  { id: 'mobility', label: 'Mobility or medical device', icon: 'wheelchair-accessibility' },
] as const;

export default function HouseholdScreen() {
  const theme = useTheme();

  // Shared draft, so answers survive going back and screen 6 can save them.
  const { draft, updateDraft } = useOnboardingDraft();

  // Recomputed every render, so the panel moves the moment a stepper is tapped.
  const targets = computeTargets(draft.adults, draft.kids, draft.pets);

  // A new array each time — React only re-renders when it gets a different array.
  function toggleConcern(id: string) {
    if (draft.concerns.includes(id)) {
      updateDraft({ concerns: draft.concerns.filter((concernId) => concernId !== id) });
    } else {
      updateDraft({ concerns: [...draft.concerns, id] });
    }
  }

  const chips = [];
  for (const concern of CONCERNS) {
    const isOn = draft.concerns.includes(concern.id);
    chips.push(
      <Pressable
        key={concern.id}
        onPress={() => toggleConcern(concern.id)}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.chipPressed,
        ]}>
        <MaterialCommunityIcons
          name={concern.icon}
          size={18}
          color={isOn ? theme.primaryDeep : theme.textSecondary}
        />
        <ThemedText themeColor={isOn ? 'primaryDeep' : 'text'} style={styles.chipLabel}>
          {concern.label}
        </ThemedText>

        {isOn ? (
          <MaterialCommunityIcons name="check" size={18} color={theme.primaryDeep} />
        ) : null}
      </Pressable>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <OnboardingHeader step={CURRENT_STEP} />

        {/* Without keyboardShouldPersistTaps, the first tap while typing only closes the keyboard. */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary" style={styles.stepLabel}>
              Step {CURRENT_STEP} of {TOTAL_STEPS}
            </ThemedText>

            <ThemedText style={styles.title}>Who&apos;s going to be with you?</ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Your answers set the quantities on your checklist, so you&apos;re never working
              them out in a store aisle.
            </ThemedText>
          </View>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Your name
            </ThemedText>

            <TextInput
              value={draft.name}
              onChangeText={(text) => updateDraft({ name: text })}
              placeholder="Aryan"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoCorrect={false} // stops an unusual name being 'fixed' into a word
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

            <ThemedText themeColor="textSecondary" style={styles.fieldHelp}>
              Only used to greet you on the home screen. You can leave it blank.
            </ThemedText>
          </View>

          <View
            style={[
              styles.card,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <StepperRow
              label="Adults"
              hint="Including you"
              value={draft.adults}
              onChange={(value) => updateDraft({ adults: value })}
              min={1}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <StepperRow
              label="Children"
              hint="Under 18"
              value={draft.kids}
              onChange={(value) => updateDraft({ kids: value })}
              min={0}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <StepperRow
              label="Pets"
              hint="Cats and dogs drink too"
              value={draft.pets}
              onChange={(value) => updateDraft({ pets: value })}
              min={0}
            />
          </View>

          {/* Cites Florida alone: it covers both the gallon and the 7 days. ready.gov says 3 days. */}
          <View style={[styles.summary, { backgroundColor: theme.backgroundSelected }]}>
            <MaterialCommunityIcons name="water-outline" size={20} color={theme.primaryDeep} />

            <View style={styles.summaryText}>
              <ThemedText style={styles.targetsText}>
                That&apos;s about{' '}
                <ThemedText style={styles.targetsNumber}>{targets.waterGallons} gallons</ThemedText>{' '}
                of water and{' '}
                <ThemedText style={styles.targetsNumber}>{targets.meals}</ThemedText> no-cook meals.
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.footnote}>
                {PLANNING_DAYS} days at a gallon per person, per day — Florida emergency management
              </ThemedText>
            </View>
          </View>

          <View style={styles.concernsBlock}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Anything else to plan for
            </ThemedText>

            <View style={styles.chipRow}>{chips}</View>
          </View>
        </ScrollView>

        {/* Outside the ScrollView, so it stays pinned to the bottom. */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push('/onboarding/location')}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primaryDeep },
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
  field: {
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 17,
  },
  fieldHelp: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: 16,
  },
  divider: {
    height: 1,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  summaryText: {
    flex: 1,
    gap: Spacing.one,
  },
  targetsText: {
    fontSize: 16,
    lineHeight: 24,
  },
  targetsNumber: {
    fontWeight: '700',
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
  },
  concernsBlock: {
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  chipRow: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  chipPressed: {
    opacity: 0.6,
  },
  chipLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
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
