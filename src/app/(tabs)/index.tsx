// Home screen — greeting, readiness ring, category breakdown, storm row.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReadinessRing } from '@/components/readiness-ring';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { getCachedAlerts, type CachedAlerts } from '@/db/alerts';
import { getChecklistProgress, type ChecklistProgress } from '@/db/checklist';
import { getCoveredCategoryCount } from '@/db/documents';
import { getHousehold, type Household } from '@/db/household';
import {
  getLowestSupply,
  getSoonestExpiring,
  getSupplyCoverage,
  type LowestSupply,
  type SoonestExpiring,
  type SupplyCoverage,
} from '@/db/inventory';
import { getAreas } from '@/db/property';
import { useTheme } from '@/hooks/use-theme';
import { levelFor, topAlert, type AlertLevel } from '@/lib/alert-rules';
import { DOCUMENT_CATEGORIES } from '@/lib/document-categories';
import { daysUntil, expiryLabel, isExpiringSoon } from '@/lib/expiry';
import { type AlertData } from '@/lib/nws';
import { isPro } from '@/lib/pro';
import { iconFor, type IconName } from '@/lib/supply-icons';

// One needs-attention card. id is the supply it's about — where tapping the card goes.
type AttentionItem = { id: number; title: string; subtitle: string; icon: IconName };

function buildBreakdown(
  progress: ChecklistProgress | null,
  household: Household | null,
  coverage: SupplyCoverage | null,
  coveredCategories: number,
  notificationsGranted: boolean
) {
  let checklistPercent = 0;
  if (progress !== null && progress.total > 0) {
    checklistPercent = Math.round((progress.done / progress.total) * 100);
  }

  // Stocked against target across the countable supplies (water, food, flashlights).
  let suppliesPercent = 0;
  if (coverage !== null && coverage.target > 0) {
    suppliesPercent = Math.round((coverage.stocked / coverage.target) * 100);
  }

  // Categories with at least one document, so ten insurance photos can't stand in for a missing ID.
  const documentsPercent = Math.round((coveredCategories / DOCUMENT_CATEGORIES.length) * 100);

  // Both halves have to be true for an alert to land: a zone to watch, and iOS permission.
  let alertsPercent = 0;
  if (household !== null && household.nws_zone_id !== null) {
    alertsPercent += 50;
  }
  if (notificationsGranted) {
    alertsPercent += 50;
  }

  return [
    { label: 'Supplies', percent: suppliesPercent },
    { label: 'Checklist', percent: checklistPercent },
    { label: 'Documents', percent: documentsPercent },
    { label: 'Alerts', percent: alertsPercent },
  ];
}

// The ring is these bars averaged.
function computeReadinessScore(breakdown: { label: string; percent: number }[]) {
  let total = 0;
  for (const item of breakdown) {
    total += item.percent;
  }

  return Math.round(total / breakdown.length);
}

// '3 of 25 gallons stored', or without a unit when the item doesn't have one (flashlights).
function stockedLabel(quantity: number, target: number, unit: string | null) {
  if (unit === null) {
    return `${quantity} of ${target} stored`;
  }

  return `${quantity} of ${target} ${unit} stored`;
}

// The supply furthest from its target, or nothing if everything's at least half-stocked.
function buildLowSupplyCard(lowest: LowestSupply | null): AttentionItem | null {
  if (lowest === null || lowest.target_qty === 0) {
    return null;
  }

  if (lowest.quantity / lowest.target_qty >= 0.5) {
    return null;
  }

  return {
    id: lowest.id,
    title: `${lowest.name} running low`,
    subtitle: stockedLabel(lowest.quantity, lowest.target_qty, lowest.unit),
    icon: iconFor(lowest.template_id),
  };
}

// The supply due for replacing soonest, or nothing if it isn't close yet.
function buildExpiryCard(soonest: SoonestExpiring | null, today: Date): AttentionItem | null {
  if (soonest === null) {
    return null;
  }

  const daysLeft = daysUntil(soonest.expires_at, today);
  if (!isExpiringSoon(daysLeft)) {
    return null;
  }

  return {
    id: soonest.id,
    title: `${soonest.name} due for replacing`,
    subtitle: expiryLabel(daysLeft),
    icon: 'clock-alert-outline',
  };
}

// The line under the greeting. Reads the same saved NWS answer as the storm row.
function buildGreetingSummary(level: AlertLevel | null, alert: AlertData | null) {
  if (level === 'warning' && alert !== null) {
    return `There's a ${alert.event} out for your area. Follow official guidance and finish what you can.`;
  }

  if (level === 'watch' && alert !== null) {
    return `There's a ${alert.event} out for your area. Still time to prepare calmly.`;
  }

  if (level === 'calm') {
    return 'No watches or warnings today. A quiet stretch is the best time to get ahead.';
  }

  // Nothing saved yet, so it claims nothing about the weather.
  return 'Everything you add here works offline, storm or no storm.';
}

// City and state, never the county.
function buildStormDetail(place: string | null) {
  if (place === null || place === '') {
    return 'National Weather Service';
  }

  return place + ' · National Weather Service';
}

function BreakdownBar({ label, percent }: { label: string; percent: number }) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLabelRow}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {percent}%
        </ThemedText>
      </View>
      <ThemedView type="backgroundSelected" style={styles.barTrack}>
        <ThemedView type="primary" style={[styles.barFill, { width: `${percent}%` }]} />
      </ThemedView>
    </View>
  );
}

// The name is optional in onboarding, so an empty one drops the whole clause.
function buildGreeting(name: string | null) {
  const hour = new Date().getHours();

  let timeOfDay = 'evening';
  if (hour < 12) {
    timeOfDay = 'morning';
  } else if (hour < 18) {
    timeOfDay = 'afternoon';
  }

  if (name === null || name === '') {
    return `Good ${timeOfDay}.`;
  }

  return `Good ${timeOfDay}, ${name}.`;
}

export default function HomeScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  // Null only ever means 'not read yet' — the gate guarantees a row exists.
  const [household, setHousehold] = useState<Household | null>(null);
  const [progress, setProgress] = useState<ChecklistProgress | null>(null);
  const [coverage, setCoverage] = useState<SupplyCoverage | null>(null);
  const [lowestSupply, setLowestSupply] = useState<LowestSupply | null>(null);
  const [soonestExpiring, setSoonestExpiring] = useState<SoonestExpiring | null>(null);
  const [coveredCategories, setCoveredCategories] = useState(0);

  // Saved by the Alerts tab. Home never fetches, so the two can't show different storms.
  const [alerts, setAlerts] = useState<CachedAlerts | null>(null);

  // Lives in iOS, not the database, so it gets re-read every time the tab is focused.
  const [notificationsGranted, setNotificationsGranted] = useState(false);

  // Tab screens stay mounted, so a plain useEffect would only read once at launch.
  useFocusEffect(
    // Memoised, or the effect re-runs on every render.
    useCallback(() => {
      async function load() {
        const householdRow = await getHousehold(db);
        setHousehold(householdRow);

        // Needs the zone, so it reads off the row rather than waiting for state to settle.
        if (householdRow?.nws_zone_id) {
          setAlerts(await getCachedAlerts(db, householdRow.nws_zone_id));
        }

        setProgress(await getChecklistProgress(db));
        setCoverage(await getSupplyCoverage(db));
        setLowestSupply(await getLowestSupply(db));
        setSoonestExpiring(await getSoonestExpiring(db));
        setCoveredCategories(await getCoveredCategoryCount(db));

        const permission = await Notifications.getPermissionsAsync();
        setNotificationsGranted(permission.granted);
      }

      load();
    }, [db])
  );

  // Pro gates starting a record, never opening one that already has areas.
  async function openPropertyRecord() {
    const areas = await getAreas(db);
    if (areas.length === 0 && !(await isPro(db))) {
      Alert.alert(
        'A Pro feature',
        'Unlock Pro to keep a dated before-and-after record of your home.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/property');
  }

  const breakdown = buildBreakdown(progress, household, coverage, coveredCategories, notificationsGranted);
  const readinessScore = computeReadinessScore(breakdown);

  const breakdownBars = [];
  for (const item of breakdown) {
    breakdownBars.push(
      <BreakdownBar key={item.label} label={item.label} percent={item.percent} />
    );
  }

  // The same two helpers the Alerts tab uses, so the screens can't disagree.
  const stormLevel = alerts === null ? null : levelFor(alerts.alerts);
  const stormAlert = alerts === null ? null : topAlert(alerts.alerts);

  // NWS's own event name — never our own words for what the storm is.
  let stormLabel = 'No active alerts';
  if (stormAlert !== null) {
    stormLabel = `${stormAlert.event} in effect`;
  }

  // Typed as string so the reassignments below aren't locked to the green it starts as.
  let stormDotColor: string = theme.primary;
  if (stormLevel === 'watch') {
    stormDotColor = theme.warningFill;
  }
  if (stormLevel === 'warning') {
    stormDotColor = theme.dangerFill;
  }

  // Both cards are real now — each can independently decide it has nothing to say.
  const attentionItems: AttentionItem[] = [];
  const lowSupplyCard = buildLowSupplyCard(lowestSupply);
  if (lowSupplyCard !== null) {
    attentionItems.push(lowSupplyCard);
  }
  const expiryCard = buildExpiryCard(soonestExpiring, new Date());
  if (expiryCard !== null) {
    attentionItems.push(expiryCard);
  }

  // "1 items" reads wrong, so pick the word to match the count.
  const attentionCount = attentionItems.length;
  const attentionLabel =
    attentionCount === 1 ? '1 item' : `${attentionCount} items`;

  const attentionCards = [];
  for (const item of attentionItems) {
    attentionCards.push(
      <Pressable
        key={item.id}
        onPress={() => router.push(`/supply/${item.id}`)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.warningCard,
          { backgroundColor: theme.warningBackground },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.warningIconDisc, { backgroundColor: theme.backgroundElement }]}>
          <MaterialCommunityIcons
            name={item.icon}
            size={20}
            color={theme.warning}
          />
        </View>

        <View style={styles.warningCardText}>
          <ThemedText type="smallBold">
            {item.title}
          </ThemedText>
          <ThemedText type="small" themeColor="warning">
            {item.subtitle}
          </ThemedText>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={theme.warning}
        />
      </Pressable>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            {/* Settings lives on this row rather than taking a 5th tab. */}
            <View style={styles.titleRow}>
              <ThemedText style={styles.greeting}>{buildGreeting(household?.name ?? null)}</ThemedText>
              <Pressable
                onPress={() => router.push('/settings')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={({ pressed }) => [
                  styles.settingsButton,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="cog"
                  size={27}
                  color={theme.primaryDeep}
                />
              </Pressable>
            </View>

            {/* Fact first, reassurance last. */}
            <ThemedText themeColor="textSecondary" style={styles.summary}>
              {buildGreetingSummary(stormLevel, stormAlert)}
            </ThemedText>
          </View>

          {/* Score and bars share one card: apart they said the same thing twice. */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.readinessRow}>
              <ReadinessRing score={readinessScore} size={124} width={11} />

              <View style={styles.breakdownColumn}>{breakdownBars}</View>
            </View>

            {/* A score with no explanation reads as arbitrary. */}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ThemedText themeColor="textSecondary" style={styles.cardFootnote}>
              The average of these four bars.
            </ThemedText>
          </ThemedView>

          {/* Hidden when neither card has anything to say. */}
          {attentionItems.length > 0 && (
          <View style={styles.needsAttentionSection}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText type="smallBold">Needs attention</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {attentionLabel}
              </ThemedText>
            </View>

            {attentionCards}
          </View>
          )}

          {/* Points into Alerts. Hidden until Alerts has saved an answer. */}
          {alerts !== null && (
          <ThemedView type="backgroundElement" style={styles.stormRow}>
            <View style={[styles.stormDot, { backgroundColor: stormDotColor }]} />

            <View style={styles.stormText}>
              <ThemedText type="smallBold">{stormLabel}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {buildStormDetail(household?.place ?? null)}
              </ThemedText>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={theme.textSecondary}
            />
          </ThemedView>
          )}

          {/* Last on purpose: a once-a-season job, not something to act on today. */}
          <View style={styles.propertySection}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText type="smallBold">Storm property record</ThemedText>
            </View>

            <Pressable
              onPress={openPropertyRecord}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.propertyRow,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.propertyIconDisc, { backgroundColor: theme.backgroundSelected }]}>
                <MaterialCommunityIcons name="home-outline" size={20} color={theme.primaryDeep} />
              </View>

              <View style={styles.propertyText}>
                <ThemedText type="smallBold">Photograph your home</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Dated before and after photos
                </ThemedText>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  greeting: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -3,
  },
  summary: {
    lineHeight: 24,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  breakdownColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  stormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  stormDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stormText: {
    flex: 1,
    gap: Spacing.half,
  },
  needsAttentionSection: {
    gap: Spacing.two,
  },
  divider: {
    height: 1,
  },
  cardFootnote: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  warningIconDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCardText: {
    flex: 1,
    gap: Spacing.half,
  },
  breakdownRow: {
    gap: Spacing.half,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barTrack: {
    height: 8,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Spacing.two,
  },
  propertySection: {
    gap: Spacing.two,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  propertyIconDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyText: {
    flex: 1,
    gap: Spacing.half,
  },
});
