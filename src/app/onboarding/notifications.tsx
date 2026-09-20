// Onboarding screen 5 of 6 — the notification permission ask.
// The phone only shows its popup once or twice, so this explains what gets sent first.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { OnboardingHeader, TOTAL_STEPS } from '@/components/onboarding/onboarding-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestNotificationPermission } from '@/lib/notifications';
import { formatPlace } from '@/lib/nws';

const CURRENT_STEP = 4;

// The only two the app sends. An off-season check-in was cut as a third.
const NOTIFICATION_TYPES = [
  {
    id: 'storm',
    icon: 'weather-hurricane',
    title: 'Storm watches and warnings',
    detail: 'Only when the National Weather Service issues one for your area.',
  },
  {
    id: 'expiring',
    icon: 'clock-alert-outline',
    title: 'Supplies due for replacing',
    detail: '30 and 7 days before a supply is due.',
  },
] as const;

// Two answers, not two actions — Continue is still the only thing that moves you on.
const CHOICES = [
  { id: 'on', label: 'Turn on notifications', detail: 'Recommended' },
  { id: 'later', label: 'Not now', detail: 'You can turn them on later' },
] as const;

type ChoiceId = 'on' | 'later';

export default function NotificationsScreen() {
  const theme = useTheme();
  const { draft } = useOnboardingDraft();

  // Names the place from screen 3, or the plain sentence if the lookup was offline.
  let subtitle = 'Just two kinds of notifications.';
  if (draft.point !== null) {
    subtitle =
      'Just two kinds of notifications, and only about ' +
      formatPlace(draft.point) +
      '.';
  }

  // Local, not in the draft — the real answer lives in the phone's settings.
  const [choice, setChoice] = useState<ChoiceId | null>(null);

  async function handleChoice(id: ChoiceId) {
    if (id === 'later') {
      setChoice('later');
      return;
    }

    // Selects from the phone's answer, not the tap, so declining never leaves this row green.
    const result = await requestNotificationPermission();
    if (result.granted) {
      setChoice('on');
    } else {
      setChoice('later');
    }
  }

  const choiceRows = [];
  for (const item of CHOICES) {
    const isOn = choice === item.id;
    choiceRows.push(
      <Pressable
        key={item.id}
        onPress={() => handleChoice(item.id)}
        accessibilityState={{ selected: isOn }}
        style={({ pressed }) => [
          styles.choiceRow,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}>
        <View
          style={[
            styles.radio,
            {
              borderColor: isOn ? theme.primaryDeep : theme.border,
              backgroundColor: isOn ? theme.primaryDeep : 'transparent',
            },
          ]}>
          {/* Dark fill, so the check has to flip to white. */}
          {isOn ? <MaterialCommunityIcons name="check-bold" size={14} color="#FFFFFF" /> : null}
        </View>

        <View style={styles.choiceBody}>
          <ThemedText themeColor={isOn ? 'primaryDeep' : 'text'} style={styles.choiceLabel}>
            {item.label}
          </ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.choiceDetail}>
            {item.detail}
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  const typeRows = [];
  for (const type of NOTIFICATION_TYPES) {
    if (typeRows.length > 0) {
      typeRows.push(
        <View
          key={type.id + '-divider'}
          style={[styles.divider, { backgroundColor: theme.border }]}
        />
      );
    }

    typeRows.push(
      <View key={type.id} style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSelected }]}>
          <MaterialCommunityIcons name={type.icon} size={22} color={theme.primaryDeep} />
        </View>

        <View style={styles.rowBody}>
          <ThemedText style={styles.rowTitle}>{type.title}</ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
            {type.detail}
          </ThemedText>
        </View>
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

            <ThemedText style={styles.title}>How we&apos;ll interrupt you</ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          </View>

          {/* No border — a bordered white card means 'fill this in' elsewhere. */}
          <View style={[styles.rows, { backgroundColor: theme.backgroundElement }]}>
            {typeRows}
          </View>

          {/* Cards, not pills — two lines of text don't fit a pill. */}
          <View style={styles.choices}>{choiceRows}</View>

          <ThemedText themeColor="textSecondary" style={styles.attribution}>
            Alerts come from the National Weather Service — the official source. Outerwinds
            never invents a forecast of its own.
          </ThemedText>
        </ScrollView>

        <View style={styles.footer}>
          {/* Ungated — leaving both unpicked is a valid answer. */}
          <Pressable
            onPress={() => router.push('/onboarding/summary')}
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
  rows: {
    marginTop: Spacing.four,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
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
  },
  rowBody: {
    flex: 1,
    gap: Spacing.one,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  rowDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  choices: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  attribution: {
    marginTop: Spacing.four,
    fontSize: 13,
    lineHeight: 18,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBody: {
    flex: 1,
    gap: 2,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  choiceDetail: {
    fontSize: 13,
    lineHeight: 18,
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
