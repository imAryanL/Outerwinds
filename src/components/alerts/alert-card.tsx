// The active alert card — amber for a watch (conditions possible), red for a warning
// (conditions expected). Both share this component; only the colors and wording change.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { AlertData } from "@/lib/nws";

type AlertCardProps = {
  // "watch" = conditions possible (amber); "warning" = conditions expected (red).
  severity: "watch" | "warning";

  // The alert itself, straight from NWS. Every word of fact on this card comes from
  // here — the app never writes a forecast of its own.
  alert: AlertData;
};

export function AlertCard({ severity, alert }: AlertCardProps) {
  const theme = useTheme();

  // Only the colors and label change between a watch and a warning. The light amber fill
  // takes dark text; the dark red fill takes white — that's the badgeTextColor flip.
  const isWarning = severity === "warning";
  const cardBackground = isWarning ? theme.dangerBackground : theme.warningBackground;
  const badgeFill = isWarning ? theme.dangerFill : theme.warningFill;
  const badgeTextColor = isWarning ? "#FFFFFF" : theme.onWarningFill;

  // NWS names the event itself ('Hurricane Warning', 'Storm Surge Watch'), so the badge
  // is never wrong about which kind of alert this is.
  const badgeLabel = alert.event.toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: cardBackground }]}>
      {/* Severity badge — the first thing your eye should land on. */}
      <View style={[styles.badge, { backgroundColor: badgeFill }]}>
        {/* Storm symbol — a placeholder for the signal-flag system coming later. */}
        <MaterialCommunityIcons
          name="weather-hurricane"
          size={13}
          color={badgeTextColor}
        />
        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>
          {badgeLabel}
        </ThemedText>
      </View>

      {/* NWS's own headline, verbatim. It already says what is happening, where, and
          until when — rewriting it would mean writing a forecast. */}
      <ThemedText style={styles.headline}>{alert.headline}</ThemedText>

      {/* What the classification means. Deliberately carries NO storm specifics: this
          sentence is true of every NWS watch or warning, so it can never contradict the
          alert above it. The old copy named wind speeds NWS doesn't give us. */}
      {isWarning ? (
        <ThemedText style={styles.body}>
          A warning means these conditions are expected or already happening —
          it&apos;s time to finish every task and follow local emergency guidance.
        </ThemedText>
      ) : (
        <ThemedText style={styles.body}>
          A watch means these conditions are possible — it&apos;s the signal to
          finish preparing, not a reason to panic.
        </ThemedText>
      )}

      {/* The office that actually issued it. Not textSecondary: muted gray washes out
          on the card. */}
      <ThemedText style={styles.issued}>{alert.senderName}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: "flex-start", // left-aligned: this card is for reading, not admiring
  },
  headline: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 26, // scaled down with the font size to keep the wrap tight
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
    lineHeight: 22, // still generous, since this is the paragraph people read under stress
  },
  stat: {
    fontWeight: "700", // bold instead of a color — scannable without looking like a link
    lineHeight: 22, // must match the paragraph or the line spacing jumps
  },
  issued: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.7, // quieter than the body without relying on textSecondary's gray
  },
  badge: {
    alignSelf: "flex-start", // hugs its text instead of stretching the card's width
    flexDirection: "row", // icon and text side by side
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.5, // small caps read better with a little breathing room
  },
});
