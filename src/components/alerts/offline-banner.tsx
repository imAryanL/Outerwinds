// The slate offline bar, shown when there's no connection. Neutral dark, never amber/red:
// being offline isn't a danger, just a state that layers on top of whatever's below.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type OfflineBannerProps = {
  // When the cached NWS data was last successfully fetched.
  cachedAt: string;
};

export function OfflineBanner({ cachedAt }: OfflineBannerProps) {
  const theme = useTheme();

  return (
    <View style={[styles.banner, { backgroundColor: theme.offlineBanner }]}>
      <MaterialCommunityIcons name="wifi-off" size={21} color="#FFFFFF" />
      <ThemedText style={styles.bannerText}>
        You&apos;re offline — Outerwinds still works. Showing your last saved NWS update from {cachedAt}.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", // icon on the left, message filling the rest of the row
    alignItems: "center", // centers the icon against the (possibly wrapped) text
    gap: Spacing.two,
    paddingVertical: Spacing.two, // 8 — a slim bar, not a heavy block
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  bannerText: {
    flex: 1, // takes the rest of the row so the text wraps instead of overflowing
    color: "#FFFFFF", // white on the dark slate fill — a dark fill takes light text
    fontSize: 13,
    lineHeight: 18,
  },
});
