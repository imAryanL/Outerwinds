// Layout for the onboarding flow — the screens someone sees the very first time they
// open Outerwinds, before the tabs ever appear.
//
// This is its own stack, sitting beside the tabs rather than inside them, so these
// screens take over the whole display with no tab bar. Screens push onto a stack and
// pop back off, which is what gives us a working back gesture between steps for free.

import { Stack } from 'expo-router';

import { OnboardingDraftProvider } from '@/components/onboarding/onboarding-draft';

export default function OnboardingLayout() {
  // The provider sits above the stack, so every screen in the flow reads and writes one
  // shared set of answers instead of its own.
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingDraftProvider>
  );
}
