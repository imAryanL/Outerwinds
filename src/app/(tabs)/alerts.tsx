// Alerts tab — active watches and warnings for your zone, from the National Weather Service.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AlertCard } from "@/components/alerts/alert-card";
import { AlertsHeader } from "@/components/alerts/alerts-header";
import { CalmState } from "@/components/alerts/calm-state";
import { OfflineAvailability } from "@/components/alerts/offline-availability";
import { NextSteps } from "@/components/alerts/next-steps";
import { OfflineBanner } from "@/components/alerts/offline-banner";
import { StormTimeline } from "@/components/alerts/storm-timeline";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  Fonts,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getCachedAlerts, saveAlerts, type CachedAlerts } from "@/db/alerts";
import { getChecklist, type ChecklistItemRow } from "@/db/checklist";
import { getHousehold } from "@/db/household";
import { formatTime, levelFor, timelineFor, topAlert } from "@/lib/alert-rules";
import { fetchActiveAlerts } from "@/lib/nws";
import { seasonPercent } from "@/lib/season";

const NEXT_STEP_COUNT = 3;

// The first few unfinished items, in the checklist's own order.
function pickNextSteps(items: ChecklistItemRow[]) {
  const steps = [];
  for (const item of items) {
    if (item.done === 0) {
      steps.push(item);
    }
    if (steps.length === NEXT_STEP_COUNT) {
      break;
    }
  }
  return steps;
}

// Only real features — naming one the app doesn't have defeats the list.
const OFFLINE_FEATURES = [
  { name: "Prep checklist", note: "Saved on this device", isAvailable: true },
  { name: "Live alerts", note: "Needs a connection to refresh", isAvailable: false },
];

export default function AlertsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();

  // NWS's latest answer and when it came. Null until one exists for this zone.
  const [result, setResult] = useState<CachedAlerts | null>(null);
  // True when NWS didn't answer this time, so the result shown is an old one.
  const [isOffline, setIsOffline] = useState(false);
  const [place, setPlace] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<ChecklistItemRow[]>([]);

  // Out here rather than inside the focus effect so the retry button can run it too.
  const load = useCallback(async () => {
    // Local, so it's read before anything that needs a connection.
    setNextSteps(pickNextSteps(await getChecklist(db)));

    const household = await getHousehold(db);
    setPlace(household?.place ?? null);

    // No zone = onboarded offline, nothing to ask NWS about.
    if (!household?.nws_zone_id) {
      return;
    }
    const zoneId = household.nws_zone_id;

    // The saved answer goes up first, then gets replaced if NWS answers.
    setResult(await getCachedAlerts(db, zoneId));

    const alerts = await fetchActiveAlerts(zoneId);
    if (alerts === null) {
      setIsOffline(true);
      return;
    }

    setResult(await saveAlerts(db, zoneId, alerts));
    setIsOffline(false);
  }, [db]);

  // Called inside, not passed straight in — useFocusEffect reads a returned value as cleanup.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Derived, not stored — so the level, card, and time always come from the same answer.
  const level = result === null ? null : levelFor(result.alerts);
  const alert = result === null ? null : topAlert(result.alerts);
  const checkedAt = result === null ? null : formatTime(result.checkedAt);

  // From the alert's own times, so the rows can't describe a different storm than the card.
  const timeline = alert === null ? [] : timelineFor(alert);

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <AlertsHeader isOffline={isOffline} checkedAt={checkedAt} place={place} />

          {/* Offline layers on any state — it's connectivity, not severity. */}
          {isOffline && checkedAt !== null && <OfflineBanner cachedAt={checkedAt} />}

          {/* NWS didn't answer and nothing's saved — say so instead of guessing calm. */}
          {result === null && isOffline && (
            <View style={styles.noAnswer}>
              <View style={[styles.noAnswerIcon, { backgroundColor: theme.backgroundElement }]}>
                <MaterialCommunityIcons
                  name="cloud-off-outline"
                  size={30}
                  color={theme.textSecondary}
                />
              </View>
              <ThemedText style={styles.noAnswerTitle}>Couldn&apos;t check for alerts</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.noAnswerBody}>
                Outerwinds couldn&apos;t reach the National Weather Service, and there&apos;s no
                saved update yet. Open this tab again once you have signal.
              </ThemedText>
            </View>
          )}

          {level === "calm" && (
            <CalmState seasonTodayPercent={seasonPercent(new Date())} place={place} />
          )}

          {(level === "watch" || level === "warning") && alert !== null && (
            <AlertCard severity={level} alert={alert} />
          )}

          {alert !== null && <StormTimeline steps={timeline} />}

          {/* Hidden once everything's done. */}
          {alert !== null && nextSteps.length > 0 && <NextSteps items={nextSteps} />}

          {isOffline && (
            <OfflineAvailability features={OFFLINE_FEATURES} onRetry={load} />
          )}

          {/* Outside both states — it shows with or without an alert. */}
          <ThemedText themeColor="textSecondary" style={styles.disclaimer}>
            Outerwinds helps you prepare. Always follow official emergency guidance.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  noAnswer: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
    alignItems: "center",
    gap: Spacing.three,
  },
  noAnswerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  noAnswerTitle: {
    fontFamily: Fonts.sans,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
  },
  noAnswerBody: {
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: Spacing.three, // detaches it from the content it follows
    paddingHorizontal: Spacing.three, // keeps the line from running edge to edge
  },
});
