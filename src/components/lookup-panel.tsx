// What a ZIP lookup came back with, drawn the same way everywhere it appears — onboarding
// and the Settings edit screen.
//
// Every state gets a 2px border in its own color AND a caps label, so the status never
// depends on color alone. Keep the label through any restyle; it is what carries the
// meaning for anyone who can't tell the borders apart.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type LookupStatus = 'loading' | 'found' | 'unknown' | 'offline';

type LookupPanelProps = {
  status: LookupStatus;
  /** "Plantation, FL" — the found state is the only one that shows it. */
  place: string;
};

export function LookupPanel({ status, place }: LookupPanelProps) {
  const theme = useTheme();

  // Spends no color on purpose: nothing has been decided yet, so it must read as neither
  // good nor bad news.
  if (status === 'loading') {
    return (
      <View
        style={[
          styles.panel,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <ActivityIndicator size="small" color={theme.textSecondary} />

        <View style={styles.panelBody}>
          <ThemedText themeColor="textSecondary" style={styles.panelLabel}>
            Checking
          </ThemedText>

          <ThemedText style={styles.panelText}>Looking up your area.</ThemedText>
        </View>
      </View>
    );
  }

  if (status === 'found') {
    return (
      <View
        style={[
          styles.panel,
          { backgroundColor: theme.backgroundSelected, borderColor: theme.primary },
        ]}>
        <MaterialCommunityIcons
          name="map-marker-check-outline"
          size={18}
          color={theme.primaryDeep}
        />

        <View style={styles.panelBody}>
          <ThemedText themeColor="primaryDeep" style={styles.panelLabel}>
            Location found!
          </ThemedText>

          <ThemedText style={styles.panelPlace}>{place}</ThemedText>

          <ThemedText themeColor="textSecondary" style={styles.panelNote}>
            We will show the National Weather Service warnings for this area. Get prepared.
          </ThemedText>
        </View>
      </View>
    );
  }

  // The bundled table covers home addresses, not PO boxes and single-building ZIPs, so this
  // means "not the ZIP we need" rather than "not a real ZIP".
  if (status === 'unknown') {
    return (
      <View
        style={[
          styles.panel,
          { backgroundColor: theme.warningBackground, borderColor: theme.warning },
        ]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.warning} />

        <View style={styles.panelBody}>
          <ThemedText themeColor="warning" style={styles.panelLabel}>
            ZIP not recognized
          </ThemedText>

          <ThemedText style={styles.panelText}>Try the one for your home address.</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: theme.offlineBanner, borderColor: theme.offlineBanner },
      ]}>
      <MaterialCommunityIcons name="cloud-off-outline" size={18} color="#FFFFFF" />

      <View style={styles.panelBody}>
        {/* The dark fill is the one place the text has to be light instead of taking its
            color from the theme. */}
        <ThemedText style={[styles.panelLabel, styles.onDark]}>
          Couldn&apos;t reach the service
        </ThemedText>

        {/* Says "keep going" rather than asking the user to fix something they may not be
            able to fix — both screens are allowed to finish offline. */}
        <ThemedText style={[styles.panelText, styles.onDark]}>
          You can keep going. Landfall will finish this the next time you&apos;re online.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: 14,
    padding: Spacing.three,
    // Bordered in the state's own color. The fields above are 1px grey on white, so this
    // still reads as what your answer produced rather than another thing to fill in.
    borderWidth: 2,
  },
  panelBody: {
    flex: 1,
    gap: Spacing.one,
  },
  panelLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  panelPlace: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },
  panelText: {
    fontSize: 15,
    lineHeight: 22,
  },
  panelNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Overrides ThemedText's theme color. Only the offline panel needs it, because it's the
  // one panel with a dark fill instead of a tint.
  onDark: {
    color: '#FFFFFF',
  },
});
