// Settings, opened from the gear on Home. Notifications and About for now; household editing comes later.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import { countLabel } from "@/lib/format";
import { deleteVault } from "@/db/documents";
import { getHousehold, type Household } from "@/db/household";
import { deleteAllData } from "@/db/reset";
import { usePrintPlan } from "@/hooks/use-print-plan";
import { useTheme } from "@/hooks/use-theme";
import { success, tap, warn } from "@/lib/haptics";
import {
  registerPushToken,
  requestNotificationPermission,
  rescheduleAllReminders,
  stopAllNotifications,
} from "@/lib/notifications";
import { isPro, setProForDevelopment } from "@/lib/pro";

// The saved home_type is an id. Spelled out here rather than importing the onboarding
// list, because only the label is needed.
const HOME_TYPE_LABELS: Record<string, string> = {
  house: "House or townhouse",
  apartment: "Apartment or condo",
  mobile: "Mobile or manufactured home",
};

export default function SettingsScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  // Null until the phone answers.
  const [isOn, setIsOn] = useState<boolean | null>(null);

  // Reread every time this screen comes back into view, so returning from the edit screen
  // shows what was just saved.
  const [household, setHousehold] = useState<Household | null>(null);

  // Development only — the real unlock comes from a purchase.
  const [proOn, setProOn] = useState(false);

  const { working: printing, print } = usePrintPlan();

  async function loadHousehold() {
    setHousehold(await getHousehold(db));
    setProOn(await isPro(db));
  }

  useFocusEffect(
    useCallback(() => {
      // Not returned — useFocusEffect reads a returned value as cleanup, and an async
      // function hands back a promise.
      loadHousehold();
    }, [db])
  );
  const [canAsk, setCanAsk] = useState(false);

  async function readPermission() {
    const permission = await Notifications.getPermissionsAsync();
    setIsOn(permission.granted);
    setCanAsk(permission.canAskAgain);
  }

  // Reads again when the user comes back from the phone's Settings app.
  useEffect(() => {
    readPermission();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        readPermission();
      }
    });

    return () => subscription.remove();
  }, []);

  // The popup only shows once (iOS) or twice (Android). After that, only Settings can turn them on.
  async function turnOn() {
    if (canAsk) {
      const result = await requestNotificationPermission();
      await readPermission();

      if (result.granted) {
        success();
        rescheduleAllReminders(db);
      }

      // Not awaited, same as onboarding. No zone means the ZIP lookup never landed.
      if (result.granted && household?.nws_zone_id) {
        registerPushToken(household.nws_zone_id);
      }
    } else {
      tap();
      await Linking.openSettings();
    }
  }

  let statusText = "";
  if (isOn === true) {
    statusText = "On";
  } else if (isOn === false) {
    statusText = "Off";
  }

  let actionRow = null;
  if (isOn === false) {
    let actionLabel = "Open Settings";
    let actionIcon: "open-in-new" | "chevron-right" = "open-in-new";
    if (canAsk) {
      actionLabel = "Turn on notifications";
      actionIcon = "chevron-right";
    }

    actionRow = (
      <View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Pressable
          onPress={turnOn}
          accessibilityRole="button"
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
          <ThemedText themeColor="primaryDeep" style={styles.actionText}>
            {actionLabel}
          </ThemedText>
          <MaterialCommunityIcons name={actionIcon} size={20} color={theme.primaryDeep} />
        </Pressable>
      </View>
    );
  }

  // Alerts come off the server first: offline, nothing is deleted and the person can retry.
  // The rows go before the photos, so a failure can never leave rows pointing at missing files.
  async function deleteEverything() {
    const stopped = await stopAllNotifications();
    if (!stopped) {
      Alert.alert(
        "Couldn't delete your data",
        "Connect to the internet and try again. This also removes your phone from storm alerts."
      );
      return;
    }

    await deleteAllData(db);
    deleteVault();
    success();
    router.replace("/onboarding/welcome");
  }

  function confirmDelete() {
    Alert.alert(
      "Delete all your data?",
      "This removes your household, checklist, supplies, documents and photos from this phone, and stops storm alerts. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () => {
            warn();
            deleteEverything();
          },
        },
      ]
    );
  }

  // An app can't switch its own notifications off, so "On" needs a way out too.
  if (isOn === true) {
    actionRow = (
      <View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Pressable
          onPress={() => {
            tap();
            Linking.openSettings();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
          <ThemedText themeColor="primaryDeep" style={styles.actionText}>
            Manage in iPhone Settings
          </ThemedText>
          <MaterialCommunityIcons name="open-in-new" size={20} color={theme.primaryDeep} />
        </Pressable>
      </View>
    );
  }

  // "2 adults, 1 kid" — zero counts are dropped rather than written as "0 kids".
  let householdCounts = "";
  let householdPlace = "";
  if (household !== null) {
    const parts = [countLabel(household.adults, "adult")];
    if (household.kids > 0) {
      parts.push(countLabel(household.kids, "kid"));
    }
    if (household.pets > 0) {
      parts.push(countLabel(household.pets, "pet"));
    }
    householdCounts = parts.join(", ");

    // The city only exists if the lookup landed, so an offline setup falls back to the ZIP.
    const place = household.place ?? household.zip_code ?? "";
    const home = HOME_TYPE_LABELS[household.home_type ?? ""] ?? "";
    householdPlace = home === "" ? place : place + " · " + home;
  }

  // Falls back to Home when opened by a deep link with no history.
  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Pressable
              onPress={leave}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [
                styles.backButton,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ThemedText style={styles.title}>Settings</ThemedText>

          <View style={styles.section}>
            <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
              Household
            </ThemedText>

            <Pressable
              onPress={() => {
                tap();
                router.push("/edit-household");
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <View style={styles.row}>
                <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={28}
                    color={theme.primaryDeep}
                  />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>
                    {household?.name ? household.name : "Your household"}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
                    {householdCounts}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
                    {householdPlace}
                  </ThemedText>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={theme.textSecondary}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
              Your plan
            </ThemedText>

            <Pressable
              onPress={() => {
                tap();
                print();
              }}
              disabled={printing}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <View style={styles.row}>
                <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialCommunityIcons
                    name="printer-outline"
                    size={28}
                    color={theme.primaryDeep}
                  />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>
                    {printing ? "Making your plan…" : "Print my plan"}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
                    A PDF of your checklist, what you still need, and what is due for
                    replacing.
                  </ThemedText>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={theme.textSecondary}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
              Notifications
            </ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.row}>
                <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialCommunityIcons name="bell-outline" size={28} color={theme.primaryDeep} />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>Storm alerts and reminders</ThemedText>
                </View>
                <ThemedText themeColor="textSecondary" style={styles.rowValue}>
                  {statusText}
                </ThemedText>
              </View>

              {actionRow}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
              About
            </ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.row}>
                <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialCommunityIcons name="weather-hurricane" size={28} color={theme.primaryDeep} />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>Alerts from the National Weather Service</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
                    The official source. Outerwinds never invents a forecast.
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.row}>
                <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialCommunityIcons name="shield-check-outline" size={28} color={theme.primaryDeep} />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>Always follow official guidance</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
                    From the NWS, FEMA, and your local emergency management.
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
              Your data
            </ThemedText>

            {/* Neutral colors on purpose: red is for real storm warnings only. */}
            <Pressable
              onPress={confirmDelete}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <View style={styles.row}>
                <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialCommunityIcons name="trash-can-outline" size={28} color={theme.textSecondary} />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>Delete all my data</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
                    Start over from the beginning. This can&apos;t be undone.
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          </View>

          {/* __DEV__ is false in any release build, so this section cannot ship. */}
          {__DEV__ ? (
            <View style={styles.section}>
              <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
                Developer
              </ThemedText>

              <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.row}>
                  <View style={[styles.iconDisc, { backgroundColor: theme.backgroundSelected }]}>
                    <MaterialCommunityIcons
                      name="flask-outline"
                      size={28}
                      color={theme.primaryDeep}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>Pro unlocked</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.rowDetail}>
                      Testing switch. Not a purchase.
                    </ThemedText>
                  </View>
                  <Switch
                    value={proOn}
                    onValueChange={async (next) => {
                      // Set the state first so the switch doesn't lag behind the finger.
                      setProOn(next);
                      await setProForDevelopment(db, next);
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// The dividers and the action row indent by this, so they line up with the text beside each disc.
const ICON_DISC_SIZE = 44;

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    paddingTop: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "500",
  },
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconDisc: {
    width: ICON_DISC_SIZE,
    height: ICON_DISC_SIZE,
    borderRadius: ICON_DISC_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  rowDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowValue: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.three + ICON_DISC_SIZE + Spacing.three,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
    paddingRight: Spacing.three,
    marginLeft: Spacing.three + ICON_DISC_SIZE + Spacing.three,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
