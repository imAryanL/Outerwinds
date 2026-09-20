// Onboarding screen 1 of 6 — the welcome.
//
// This screen deliberately asks for nothing. It states what Outerwinds is, sets the tone
// for the whole app, and tells the user up front how long this will take and that no
// account is involved — the two things that make people abandon an onboarding flow.

import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {/* The middle block grows to fill whatever space is left above the button, which
            keeps the text centered on a small phone and a big one alike. */}
        <View style={styles.content}>
          {/* The same concentric rings the Alerts calm state uses, so the app has one
              visual signature from the very first screen. A solid dot in the middle
              rather than the calm state's checkmark — a check would be claiming
              "all clear" before we know anything about this household. */}
          <View style={[styles.ring1, { borderColor: theme.primarySoft }]}>
            <View style={[styles.ring2, { borderColor: theme.primarySoft }]}>
              <View style={[styles.ring3, { borderColor: theme.primarySoft }]}>
                <View
                  style={[styles.centerDot, { backgroundColor: theme.primaryDeep }]}
                />
              </View>
            </View>
          </View>

          <ThemedText style={styles.headline}>
            A clear head before the storm
          </ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.body}>
            Outerwinds helps your household get ready over weeks, at a calm pace. Your
            checklist, supplies and documents live on this phone, and keep working when
            the power and the signal don&apos;t.
          </ThemedText>
        </View>

        <View style={styles.footer}>
          {/* Deep green rather than the lighter brand green: this button is a large
              filled block with white text on it, and white on the lighter green is too
              low-contrast to read comfortably. */}
          <Pressable
            onPress={() => router.push('/onboarding/household')}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primaryDeep },
              pressed && styles.buttonPressed,
            ]}
          >
            <ThemedText style={styles.buttonText}>Let&apos;s get set up</ThemedText>
          </Pressable>

          <ThemedText themeColor="textSecondary" style={styles.footnote}>
            Takes about two minutes · No account, no sign-in
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flex: 1, // takes all the room above the footer
    justifyContent: 'center', // centers the text in that room
    gap: Spacing.four,
  },
  headline: {
    fontFamily: Fonts.serif, // the same serif treatment the four tab screens use
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '500',
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
  },
  // Three rings, outermost to innermost — same sizes as the Alerts calm state. Each
  // borderRadius is exactly half the width, which is what turns a square into a circle.
  ring1: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 1,
    alignSelf: 'center', // centers the rings across the screen, while the text below
    // stays left-aligned like every other screen title in the app
    alignItems: 'center', // centers the next ring horizontally
    justifyContent: 'center', // and vertically
    marginBottom: Spacing.two,
  },
  ring2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring3: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  footer: {
    gap: Spacing.three,
  },
  button: {
    borderRadius: 999, // anything larger than half the height gives a full pill
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85, // dims while held, so a tap feels acknowledged
  },
  buttonText: {
    color: '#FFFFFF', // fixed white, because the button fill is always dark green
    fontSize: 17,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
