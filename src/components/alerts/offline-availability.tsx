// "Still available offline" — shown when there's no connection, answering "what can I
// still use?" Plus a button that asks NWS again.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { SectionHeading } from "@/components/alerts/section-heading";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { tap } from "@/lib/haptics";

// One feature and whether it still works with no signal.
type OfflineFeature = {
  name: string;
  note: string;
  isAvailable: boolean;
};

type OfflineAvailabilityProps = {
  features: OfflineFeature[];
  onRetry: () => Promise<void>;
};

export function OfflineAvailability({ features, onRetry }: OfflineAvailabilityProps) {
  const theme = useTheme();

  const [isChecking, setIsChecking] = useState(false);
  // A check that reaches NWS hides this whole card, so still being here means it failed.
  const [hasFailed, setHasFailed] = useState(false);

  async function handleRetry() {
    tap();
    setIsChecking(true);
    setHasFailed(false);

    // Half a second minimum. Offline, the fetch fails almost instantly and the spinner
    // would flash too fast to see — which is the dead-button feeling all over again.
    const minimumSpin = new Promise((resolve) => setTimeout(resolve, 600));
    await Promise.all([onRetry(), minimumSpin]);

    setIsChecking(false);
    setHasFailed(true);
  }

  // Build one row per feature with a plain loop, same divider pattern as the next-steps card.
  const featureRows = [];
  for (const feature of features) {
    // Available = a green check. The one online-only row gets a NEUTRAL gray cloud,
    // never red — losing signal isn't danger, and red belongs to real storm warnings.
    const iconName = feature.isAvailable ? "check-circle" : "cloud-off-outline";
    const iconColor = feature.isAvailable ? theme.primary : theme.textSecondary;

    featureRows.push(
      <View key={feature.name}>
        {featureRows.length > 0 && (
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        )}

        <View style={styles.featureRow}>
          <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />

          {/* Feature name on top, why it does or doesn't work underneath. */}
          <View style={styles.featureText}>
            <ThemedText style={styles.featureName}>{feature.name}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.featureNote}>
              {feature.note}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  }

  // Spinner and a different label while a check is running.
  let buttonIcon = (
    <MaterialCommunityIcons name="refresh" size={18} color={theme.primaryDeep} />
  );
  let buttonLabel = "Check for a connection";
  if (isChecking) {
    buttonIcon = <ActivityIndicator size="small" color={theme.primaryDeep} />;
    buttonLabel = "Checking…";
  }

  return (
    <View style={styles.section}>
      <SectionHeading>Still available offline</SectionHeading>
      <ThemedView type="backgroundElement" style={styles.card}>
        {featureRows}
      </ThemedView>

      {/* Outlined, not filled: a solid green block would compete with the red warning
          card, and this is just housekeeping. */}
      <Pressable
        onPress={handleRetry}
        disabled={isChecking}
        style={({ pressed }) => [
          styles.retryButton,
          { borderColor: theme.primarySoft },
          // `pressed` lets us dim the button while it's held down.
          pressed && styles.retryButtonPressed,
        ]}
      >
        {buttonIcon}
        <ThemedText themeColor="primaryDeep" style={styles.retryButtonText}>
          {buttonLabel}
        </ThemedText>
      </Pressable>

      {hasFailed && !isChecking && (
        <ThemedText themeColor="textSecondary" style={styles.retryNote}>
          Still no connection. Try again once you have signal.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two, // same heading-to-card spacing as the timeline and next-steps sections
    marginTop: Spacing.three,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: Spacing.four, // no vertical padding — the rows space themselves
  },
  featureRow: {
    flexDirection: "row", // icon on the left, the two lines of text beside it
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  featureText: {
    flex: 1, // takes the rest of the row so long names wrap instead of overflowing
    gap: 2, // hairline gap: the note reads as attached to the name above it
  },
  featureName: {
    fontSize: 14,
    lineHeight: 20,
  },
  featureNote: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
  },
  retryButton: {
    flexDirection: "row", // refresh icon next to the label
    alignItems: "center",
    justifyContent: "center", // centers the icon+label pair inside the full-width button
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1, // outlined, not filled — see the note in the JSX
  },
  retryButtonPressed: {
    opacity: 0.6, // visible feedback while the finger is down
  },
  retryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600", // slightly heavier than body text so it reads as an action
  },
  retryNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
