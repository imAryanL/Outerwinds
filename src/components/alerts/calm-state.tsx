// The calm "all clear" state. Frameless — cards are saved for real watches and warnings.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { SeasonBar } from "@/components/alerts/season-bar";
import { ThemedText } from "@/components/themed-text";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { tap } from "@/lib/haptics";

type CalmStateProps = {
  seasonTodayPercent: number;
  place: string | null;
  // The NWS page for this location. Null hides the link.
  noticeUrl: string | null;
};

export function CalmState({ seasonTodayPercent, place, noticeUrl }: CalmStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.calmState}>
      <View style={[styles.ring1, { borderColor: theme.primarySoft }]}>
        <View style={[styles.ring2, { borderColor: theme.primarySoft }]}>
          <View style={[styles.ring3, { borderColor: theme.primarySoft }]}>
            <View
              style={[
                styles.innerCircle,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <MaterialCommunityIcons
                name="check"
                size={30}
                color={theme.primaryDeep}
              />
            </View>
          </View>
        </View>
      </View>

      <ThemedText style={styles.calmTitle}>No active alerts</ThemedText>

      <ThemedText themeColor="textSecondary" style={styles.calmBody}>
        The National Weather Service hasn&apos;t issued any watches or warnings
        for {place ?? "your area"}.
      </ThemedText>

      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.calmFootnote}
      >
        Outerwinds saves the newest update, so it&apos;s still here if you lose
        signal.
      </ThemedText>

      {/* A saved "all clear" can be hours old, so this is how to check it at the source. */}
      {noticeUrl !== null && (
        <Pressable
          onPress={() => {
            tap();
            Linking.openURL(noticeUrl);
          }}
          accessibilityRole="link"
          accessibilityLabel="Check the National Weather Service forecast for your area"
          hitSlop={8}
          style={({ pressed }) => [styles.noticeLink, pressed && styles.noticeLinkPressed]}>
          <ThemedText type="small" themeColor="primaryDeep" style={styles.noticeText}>
            Check the NWS forecast for your area
          </ThemedText>
          <MaterialCommunityIcons name="open-in-new" size={15} color={theme.primaryDeep} />
        </Pressable>
      )}

      <SeasonBar todayPercent={seasonTodayPercent} />

      {/* Tint, not a card — it's an FYI, not an alert. */}
      <View style={[styles.nudge, { backgroundColor: theme.backgroundSelected }]}>
        <MaterialCommunityIcons
          name="lightbulb-outline"
          size={25}
          color={theme.primaryDeep}
        />
        <ThemedText themeColor="primaryDeep" style={styles.nudgeText}>
          Quiet week, a good time to test flashlights, restock batteries, and refresh your water.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calmState: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    alignItems: "center",
    gap: Spacing.three,
  },
  calmTitle: {
    fontFamily: Fonts.sans,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
  },
  calmBody: {
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  calmFootnote: {
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  noticeLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  noticeLinkPressed: {
    opacity: 0.6,
  },
  noticeText: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  nudge: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.three,
  },
  nudgeText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  // Outermost to innermost; each borderRadius is half the width.
  ring1: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ring2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ring3: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
