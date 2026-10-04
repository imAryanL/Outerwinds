// The Pro paywall. A green sheet that slides up from a locked feature, from Settings,
// and once after onboarding.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfter } from '@/components/paywall/before-after';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { success, tap } from '@/lib/haptics';
import { PRIVACY_URL } from '@/lib/links';
import { FREE_DOCUMENT_LIMIT, isPro } from '@/lib/pro';
import { buyPro, getProPackage, restorePro } from '@/lib/purchases';

// Text and marks that sit straight on the green. White in both themes, since the green doesn't change.
const ON_GREEN = '#FFFFFF';
const ON_GREEN_FAINT = 'rgba(255, 255, 255, 0.22)';

// Apple's standard terms for apps, which cover an in-app purchase like this one.
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// loading: asking the store. ready: there is a price to show. unavailable: the store
// didn't answer. owned: this person already has Pro.
type Status = 'loading' | 'ready' | 'unavailable' | 'owned';

const BENEFITS = [
  {
    id: 'property',
    icon: 'home-outline',
    title: 'Storm property record',
    detail: 'Dated before and after photos of your home, for insurance.',
  },
  {
    id: 'documents',
    icon: 'file-multiple-outline',
    title: 'Unlimited documents',
    detail: `Free holds ${FREE_DOCUMENT_LIMIT}. Pro holds them all.`,
  },
  {
    id: 'plan',
    icon: 'printer-outline',
    title: 'Print my plan',
    detail: 'Your checklist as a PDF.',
  },
  {
    id: 'export',
    icon: 'file-pdf-box',
    title: 'Export documents as PDF',
    detail: 'A whole policy in one file.',
  },
  {
    id: 'reminders',
    icon: 'bell-outline',
    title: 'Renewal reminders',
    detail: 'Before a policy or ID runs out.',
  },
] as const;

export default function PaywallScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [status, setStatus] = useState<Status>('loading');
  const [proPackage, setProPackage] = useState<PurchasesPackage | null>(null);
  // True while a purchase or a restore is running, so a second tap can't start another.
  const [busy, setBusy] = useState(false);
  // The small thank-you popup, shown once a purchase goes through.
  const [showWelcome, setShowWelcome] = useState(false);

  // Out here rather than inside the effect, so "Try again" can run it too.
  const load = useCallback(async () => {
    setStatus('loading');

    if (await isPro(db)) {
      setStatus('owned');
      return;
    }

    const found = await getProPackage();
    if (found === null) {
      setStatus('unavailable');
      return;
    }

    setProPackage(found);
    setStatus('ready');
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBuy() {
    if (proPackage === null || busy) {
      return;
    }

    tap();
    setBusy(true);
    try {
      const result = await buyPro(proPackage);
      if (result === 'bought') {
        success();
        setShowWelcome(true);
        return;
      }
      // Cancelled: nothing to say, the sheet just stays open.
    } catch {
      Alert.alert("The purchase didn't go through", "You weren't charged. Please try again.");
    }
    setBusy(false);
  }

  async function handleRestore() {
    if (busy) {
      return;
    }

    tap();
    setBusy(true);
    try {
      const restored = await restorePro();
      if (restored) {
        success();
        router.back();
        return;
      }
      Alert.alert('Nothing to restore', "We couldn't find a past purchase on this Apple account.");
    } catch {
      Alert.alert("Couldn't restore", 'Check your connection and try again.');
    }
    setBusy(false);
  }

  // The top of the footer changes with the status. The links under it never do.
  let footerMain = (
    <View style={styles.buyButton}>
      <ActivityIndicator color={theme.primaryButton} />
    </View>
  );
  let footerNote = 'Pay once. Keep it every hurricane season.';

  if (status === 'ready' && proPackage !== null) {
    // The price is the store's own text, so it always matches what Apple charges.
    const buyLabel = busy ? 'Working…' : `Unlock Pro · ${proPackage.product.priceString}`;
    footerMain = (
      <Pressable
        onPress={handleBuy}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.buyButton, pressed && styles.pressed]}>
        <Text style={[styles.buyText, { color: theme.primaryButton }]}>{buyLabel}</Text>
      </Pressable>
    );
  }

  if (status === 'unavailable') {
    footerMain = (
      <Pressable
        onPress={() => {
          tap();
          load();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.buyButton, pressed && styles.pressed]}>
        <Text style={[styles.buyText, { color: theme.primaryButton }]}>Try again</Text>
      </Pressable>
    );
    footerNote = "Can't reach the App Store right now.";
  }

  if (status === 'owned') {
    footerMain = (
      <View style={styles.ownedRow}>
        <MaterialCommunityIcons name="check-circle" size={22} color={ON_GREEN} />
        <Text style={styles.ownedText}>You have Outerwinds Pro</Text>
      </View>
    );
    footerNote = 'Thank you for supporting the app.';
  }

  const rows = [];
  for (const benefit of BENEFITS) {
    // A divider before every row but the first.
    if (rows.length > 0) {
      rows.push(
        <View key={`divider-${benefit.id}`} style={[styles.divider, { backgroundColor: theme.border }]} />
      );
    }

    rows.push(
      <View key={benefit.id} style={styles.row}>
        <View style={styles.rowTop}>
          <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
            <MaterialCommunityIcons name={benefit.icon} size={22} color={theme.primaryDeep} />
          </View>
          <View style={styles.rowText}>
            <ThemedText style={styles.rowTitle}>{benefit.title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
              {benefit.detail}
            </ThemedText>
          </View>
        </View>

        {/* Only the property record shows an example. */}
        {benefit.id === 'property' && <BeforeAfter />}
      </View>
    );
  }

  return (
    <View style={[styles.sheet, { backgroundColor: theme.primaryButton }]}>
      {/* The same rings as the welcome and calm Alerts screens, pushed into the corner. */}
      <View style={styles.rings} pointerEvents="none">
        <View style={[styles.ring, styles.ring1]} />
        <View style={[styles.ring, styles.ring2]} />
        <View style={[styles.ring, styles.ring3]} />
        <View style={[styles.ring, styles.ring4]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.pill}>
              <Image source={require('@/assets/images/splash-icon.png')} style={styles.pillMark} contentFit="contain" />
              <Text style={styles.pillText}>OUTERWINDS PRO</Text>
            </View>
            <Text style={styles.headline}>More ways to protect your home</Text>
            <Text style={styles.subline}>One purchase. No subscription.</Text>
          </View>

          <Text style={styles.listLabel}>What you get</Text>

          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{rows}</View>

          <Text style={styles.promise}>
            Storm alerts, your checklist and everything you&apos;ve saved stay free.
          </Text>
        </ScrollView>

        {/* Outside the ScrollView, so the button is always in reach. */}
        <View style={styles.footer}>
          {footerMain}
          <Text style={styles.once}>{footerNote}</Text>
          <View style={styles.links}>
            <Pressable
              onPress={handleRestore}
              disabled={busy}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <Text style={styles.link}>Restore purchases</Text>
            </Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable
              onPress={() => {
                tap();
                Linking.openURL(TERMS_URL);
              }}
              accessibilityRole="link"
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <Text style={styles.link}>Terms</Text>
            </Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable
              onPress={() => {
                tap();
                Linking.openURL(PRIVACY_URL);
              }}
              accessibilityRole="link"
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <Text style={styles.link}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Floats over the corner instead of taking a row of its own. */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="close" size={20} color={ON_GREEN} />
      </Pressable>

      {/* Covers the whole sheet, so nothing behind it can be tapped. Done closes both. */}
      {showWelcome && (
        <View style={styles.welcomeBackdrop}>
          <View style={[styles.welcomeCard, { backgroundColor: theme.backgroundElement }]}>
            <Image source={require('@/assets/images/icon.png')} style={styles.welcomeIcon} />
            <ThemedText style={styles.welcomeTitle}>Welcome to{'\n'}Outerwinds Pro</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.welcomeDetail}>
              Thank you for your purchase!
            </ThemedText>
            <Pressable
              onPress={() => {
                tap();
                router.back();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.welcomeButton,
                { backgroundColor: theme.primaryButton },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.welcomeButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const ICON_DISC_SIZE = 40;
const RING_AREA = 260;

const styles = StyleSheet.create({
  // Clips the rings where they run past the corner.
  sheet: {
    flex: 1,
    overflow: 'hidden',
  },
  rings: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: RING_AREA,
    height: RING_AREA,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: ON_GREEN_FAINT,
  },
  // Each ring is 68 smaller than the last and centered in the same square.
  ring1: { top: 0, left: 0, width: 260, height: 260, borderRadius: 130 },
  ring2: { top: 34, left: 34, width: 192, height: 192, borderRadius: 96 },
  ring3: { top: 68, left: 68, width: 124, height: 124, borderRadius: 62 },
  ring4: {
    top: 102,
    left: 102,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Kept tight on purpose: all five benefits should show without scrolling.
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: 12,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  pillMark: {
    width: 14,
    height: 14,
  },
  pillText: {
    color: ON_GREEN,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  headline: {
    color: ON_GREEN,
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
  },
  subline: {
    color: ON_GREEN,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  listLabel: {
    color: ON_GREEN,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.one,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  row: {
    paddingVertical: 12,
    gap: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconDisc: {
    width: ICON_DISC_SIZE,
    height: ICON_DISC_SIZE,
    borderRadius: ICON_DISC_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  rowDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
  },
  promise: {
    color: ON_GREEN,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    opacity: 0.9,
    paddingHorizontal: Spacing.three,
  },
  welcomeBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  welcomeCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: 22,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  welcomeIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: Spacing.two,
  },
  welcomeTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
    textAlign: 'center',
  },
  welcomeDetail: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  welcomeButton: {
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  welcomeButtonText: {
    color: ON_GREEN,
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    alignItems: 'center',
    gap: Spacing.two,
  },
  buyButton: {
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    backgroundColor: ON_GREEN,
  },
  buyText: {
    fontSize: 17,
    fontWeight: '600',
  },
  ownedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  ownedText: {
    color: ON_GREEN,
    fontSize: 17,
    fontWeight: '600',
  },
  once: {
    color: ON_GREEN,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  link: {
    color: ON_GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
  linkDot: {
    color: ON_GREEN,
    opacity: 0.6,
  },
});
