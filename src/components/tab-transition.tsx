// Fades a tab's content in each time the tab comes into focus. The native tab bar has no switch animation of its own.

import { useFocusEffect } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Short enough that it never feels like waiting.
const DURATION = 260;
const RISE = 10;

export function TabTransition({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);

  // The tabs stay mounted, so this runs on every switch, not just the first visit. The reset
  // happens on the way out: resetting on the way in shows one full-opacity frame first.
  useFocusEffect(
    useCallback(() => {
      progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });

      return () => {
        progress.value = 0;
      };
    }, [progress]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * RISE }],
  }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>;
}
