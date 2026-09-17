// Onboarding screen 3 of 6 — where the household lives.
//
// The ZIP typed here is the only answer in the whole flow that reaches the network. It
// becomes coordinates from a table bundled in the app, and those coordinates go to the
// National Weather Service to find out which county and alert zone cover this address.
//
// Nothing on this screen writes to the database. Screen 6 saves every answer together.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LookupPanel } from '@/components/lookup-panel';
import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { OnboardingHeader, TOTAL_STEPS } from '@/components/onboarding/onboarding-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchPointData, formatPlace } from '@/lib/nws';
import { lookupZip } from '@/lib/zip-lookup';

const CURRENT_STEP = 2;

// What the ZIP lookup came back with. The ZIP it belongs to is kept alongside it, so a slow
// answer for a ZIP the user has already retyped can never be shown under the new one.
type Lookup = {
  zip: string;
  status: 'loading' | 'found' | 'unknown' | 'offline';
  place: string; // "Plantation, FL" — empty unless the status is 'found'
};

// Mobile and manufactured homes are the reason this question is worth asking — Florida
// evacuates them first, and their prep advice genuinely differs from a house's.
export const HOME_TYPES = [
  { id: 'house', label: 'House or townhouse', icon: 'home-outline' },
  { id: 'apartment', label: 'Apartment or condo', icon: 'office-building-outline' },
  { id: 'mobile', label: 'Mobile or manufactured home', icon: 'caravan' },
] as const;

export default function LocationScreen() {
  const theme = useTheme();
  const { draft, updateDraft } = useOnboardingDraft();

  // The lookup stays on this screen. It's the state of our network call, not an answer the
  // user gave us, so screen 6 has no use for it.
  const [lookup, setLookup] = useState<Lookup | null>(null);

  // The ZIP becomes coordinates from the table bundled in the app, and those coordinates
  // go to the National Weather Service.
  async function runLookup(zipCode: string) {
    const coords = lookupZip(zipCode);

    // A new ZIP makes the old county wrong, so it's cleared before anything else. Without
    // this, changing a found ZIP to one that fails offline would carry the first ZIP's
    // county and zone into the save.
    updateDraft({ point: null });

    // The table covers home addresses, not PO boxes and single-building ZIPs, so a miss
    // here means "not the ZIP we need" rather than "not a real ZIP."
    if (coords === null) {
      setLookup({ zip: zipCode, status: 'unknown', place: '' });
      return;
    }

    setLookup({ zip: zipCode, status: 'loading', place: '' });

    const point = await fetchPointData(coords.lat, coords.lon);

    // fetchPointData returns null for no signal, a bad response, or the 8 second timeout.
    // All three mean the same thing to the user, so they share one message.
    if (point === null) {
      setLookup({ zip: zipCode, status: 'offline', place: '' });
      return;
    }

    // The whole reply is kept, not just the city. Screen 6 needs the county, zone and
    // office out of it to fill their columns.
    updateDraft({ point });
    setLookup({ zip: zipCode, status: 'found', place: formatPlace(point) });
  }

  // Going back to screen 2 destroys this screen, so coming forward again leaves the ZIP
  // filled in with no panel and a dead Continue. Put the lookup back from what the draft kept.
  useEffect(() => {
    if (draft.zip.length !== 5) {
      return;
    }

    if (draft.point !== null) {
      setLookup({ zip: draft.zip, status: 'found', place: formatPlace(draft.point) });
    } else {
      // A saved point is the only proof the lookup succeeded. Without one, 'unknown' and
      // 'offline' still need telling apart, and only 'offline' costs a request.
      runLookup(draft.zip);
    }
  }, []);

  // The number pad still offers characters we don't want stored, so anything that isn't a
  // digit is dropped as it's typed rather than validated later.
  function handleZipChange(text: string) {
    const digits = text.replace(/[^0-9]/g, '');
    updateDraft({ zip: digits });

    // Five digits is the only moment there is anything to look up.
    if (digits.length === 5) {
      // number-pad has no return key, so nothing else dismisses this.
      Keyboard.dismiss();
      runLookup(digits);
    }
  }

  // Built before the JSX, the same way screen 2 builds its chips.
  const homeRows = [];
  for (const home of HOME_TYPES) {
    const isOn = draft.homeType === home.id;
    homeRows.push(
      <Pressable
        key={home.id}
        onPress={() => updateDraft({ homeType: home.id })}
        style={({ pressed }) => [
          styles.homeRow,
          {
            borderColor: isOn ? theme.primary : theme.border,
            backgroundColor: isOn ? theme.backgroundSelected : theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}>
        <MaterialCommunityIcons
          name={home.icon}
          size={18}
          color={isOn ? theme.primaryDeep : theme.textSecondary}
        />
        <ThemedText themeColor={isOn ? 'primaryDeep' : 'text'} style={styles.homeLabel}>
          {home.label}
        </ThemedText>

        {isOn ? (
          <MaterialCommunityIcons name="check" size={18} color={theme.primaryDeep} />
        ) : null}
      </Pressable>
    );
  }

  // Only shown for the ZIP currently in the field, so an answer that arrives late can never
  // sit under a different number than the one it was looked up for.
  let panel = null;
  if (lookup !== null && lookup.zip === draft.zip) {
    panel = <LookupPanel status={lookup.status} place={lookup.place} />;
  }

  // Coordinates are the thing this screen actually has to come away with, and the bundled
  // table gives us those before the network is involved. So the offline case moves on too —
  // the county and zone get filled in the next time the app has a connection.
  const canContinue =
    lookup !== null &&
    lookup.zip === draft.zip &&
    (lookup.status === 'found' || lookup.status === 'offline');

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <OnboardingHeader step={CURRENT_STEP} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary" style={styles.stepLabel}>
              Step {CURRENT_STEP} of {TOTAL_STEPS}
            </ThemedText>

            <ThemedText style={styles.title}>Where is home?</ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              We use this to find which county&apos;s watches and warnings apply to you.
            </ThemedText>
          </View>

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Your ZIP code
            </ThemedText>

            <TextInput
              value={draft.zip}
              onChangeText={handleZipChange}
              placeholder="33322"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={5}
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
              Use the ZIP for your home address, not a PO box.
            </ThemedText>

            {panel}
          </View>

          <View style={styles.homeBlock}>
            <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
              Type of home
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.fieldHelp}>
              Hurricane guidance differs for each, especially mobile homes.
            </ThemedText>

            <View style={styles.homeRows}>{homeRows}</View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {/* Home type deliberately doesn't gate this — only the ZIP does. It's the one
              answer onboarding won't move past, since Alerts has nothing without it. */}
          <Pressable
            onPress={() => router.push('/onboarding/supplies')}
            disabled={!canContinue}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: canContinue ? theme.primaryDeep : theme.border },
              pressed && styles.buttonPressed,
            ]}>
            <ThemedText
              style={[styles.buttonText, canContinue ? null : { color: theme.textSecondary }]}>
              Continue
            </ThemedText>
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
    // Wider than the name field's tracking, so five digits read as digits at a glance.
    letterSpacing: 1,
  },
  fieldHelp: {
    fontSize: 13,
    lineHeight: 18,
  },
  homeBlock: {
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  homeRows: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  homeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2, // lands the row at 44 tall, Apple's tap minimum
  },
  homeLabel: {
    flex: 1,
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
