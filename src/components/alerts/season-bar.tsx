// The hurricane-season progress bar for the calm Alerts screen. A pure calendar: the
// green fill runs from Jun 1 to today, and a soft-green band marks the historically busy
// stretch (mid-August through mid-October). No forecast, no live weather — just dates.
// Understated (no card) so the calm screen stays lighter than the warning screen.

import { StyleSheet, View } from "react-native";

import { SectionHeading } from "@/components/alerts/section-heading";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

// The historically busy stretch, as percents of the Jun 1 – Nov 30 season (183 days).
// Fixed calendar facts — never driven by live weather, which is what keeps this bar honest.
const PEAK_START_PERCENT = 42; // ~Aug 16
const PEAK_END_PERCENT = 75; // ~Oct 15

// Sept 10, NOAA's climatological peak. Deliberately not the band's midpoint — the curve
// peaks early in the stretch and tails off, so centering the word would point at late Sep.
const PEAK_LABEL_PERCENT = 55;

// The six months of the season, drawn evenly across the bar as a rough guide.
const MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

type SeasonBarProps = {
  // How far into the season today is, 0–100. Comes from seasonPercent in lib/season.ts.
  todayPercent: number;
};

export function SeasonBar({ todayPercent }: SeasonBarProps) {
  const theme = useTheme();

  // Build the evenly-spaced month labels with a plain loop.
  const monthLabels = [];
  for (const month of MONTHS) {
    monthLabels.push(
      <ThemedText key={month} themeColor="textTertiary" style={styles.monthLabel}>
        {month}
      </ThemedText>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeading>Season progress</SectionHeading>

      {/* "PEAK" caption, centered over the band below it. */}
      <View style={styles.peakRow}>
        <ThemedText
          themeColor="primaryDeep"
          style={[styles.peakLabel, { left: `${PEAK_LABEL_PERCENT}%` }]}
        >
          PEAK
        </ThemedText>
      </View>

      {/* The bar. Fill = Jun 1 → today; the soft-green band = the historically busy
          stretch; the green dot = today. The dot sits on top, in the wrapper. */}
      <View style={styles.barWrap}>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          {/* The historically busy band — a fixed calendar range, not live weather. */}
          <View
            style={[
              styles.band,
              {
                left: `${PEAK_START_PERCENT}%`,
                width: `${PEAK_END_PERCENT - PEAK_START_PERCENT}%`,
                backgroundColor: theme.primarySoft,
              },
            ]}
          />
          {/* Progress from Jun 1 to today. */}
          <View
            style={[
              styles.fill,
              { width: `${todayPercent}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>

        {/* Today marker — a green dot at the leading edge of the fill. */}
        <View
          style={[
            styles.todayDot,
            { left: `${todayPercent}%`, backgroundColor: theme.primaryDeep },
          ]}
        />
      </View>

      {/* The six months of the season, evenly spaced. */}
      <View style={styles.monthsRow}>{monthLabels}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two, // stacks the label, caption, bar, and months evenly
    alignSelf: "stretch", // fill the width inside the center-aligned calm column
    marginTop: Spacing.three, // breathing room above, under the hero text
  },
  peakRow: {
    height: 14, // room for the PEAK caption sitting above the band
    position: "relative", // anchor for the absolutely-centered caption
    marginBottom: -Spacing.one, // pull the bar up a touch, closer to the caption
  },
  peakLabel: {
    position: "absolute",
    top: 0,
    width: 60, // fixed width so textAlign can center it on the band's midpoint
    marginLeft: -30, // shift left by half the width to center on PEAK_MID_PERCENT
    textAlign: "center",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.6, // small caps read better with a little tracking
  },
  barWrap: {
    height: 12, // taller than the 8px track so the today dot can stick out
    justifyContent: "center", // centers the track inside
    position: "relative", // anchor for the today dot
  },
  track: {
    height: 8,
    borderRadius: 4, // half the height, so the ends are rounded
    overflow: "hidden", // clips the fill to the rounded ends
    position: "relative", // anchor for the absolutely-placed band
  },
  band: {
    position: "absolute",
    top: 0,
    bottom: 0, // spans the full track height
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  todayDot: {
    position: "absolute",
    top: 0, // a 12px dot in the 12px wrapper — sits centered on the track
    width: 12,
    height: 12,
    borderRadius: 6, // half the width makes it a circle
    marginLeft: -6, // center the dot on its percent
  },
  monthsRow: {
    flexDirection: "row",
    justifyContent: "space-between", // Jun at the left, Nov at the right, evenly between
  },
  monthLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
});
