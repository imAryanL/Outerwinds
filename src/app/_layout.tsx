import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { startPurchases } from '@/lib/purchases';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Once, when the app opens.
  useEffect(() => {
    startPurchases();
  }, []);

  return (
    // Required once, at the root, for any react-native-gesture-handler gesture to work
    // anywhere in the app — the document photo zoom viewer needs it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Opens the database once for the whole app and runs any missing migration steps
          before anything renders. Same idea as a React context provider on the web: any
          screen inside can reach the database without it being passed down by hand. */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />

          {/* The stack is the root of the app now, and the tab bar is one branch of it.
              That's what lets onboarding open later as a full screen with no tabs.
              Headers are off because every screen draws its own title. */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            {/* A modal, so it slides up over whatever screen asked for it. */}
            <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
