// The paywall's two example boxes: the same house before a storm and after it.
// Drawings, not photos, so nothing pretends to be someone's real home.

import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Both drawings share this canvas, so the house sits in the same spot in each box.
const VIEW_BOX = '0 0 120 62';
const LINE = 1.5;

function BeforeHouse() {
  const theme = useTheme();

  return (
    <Svg viewBox={VIEW_BOX} style={styles.drawing}>
      {/* Ground */}
      <Path d="M4 56H116" stroke={theme.text} strokeWidth={LINE} strokeLinecap="round" />

      {/* Palm: an upright trunk and four fronds */}
      <Path d="M22 56Q25 42 21 28" stroke={theme.text} strokeWidth={LINE} strokeLinecap="round" fill="none" />
      <Path
        d="M21 28Q13 22 6 27M21 28Q15 16 8 15M21 28Q23 15 31 13M21 28Q29 22 35 26"
        stroke={theme.primaryDeep}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {/* House: walls, roof, door, two windows */}
      <Rect x={46} y={32} width={42} height={24} fill={theme.backgroundElement} stroke={theme.text} strokeWidth={LINE} />
      <Path d="M41 32L67 15L93 32Z" fill={theme.primaryDeep} stroke={theme.text} strokeWidth={LINE} strokeLinejoin="round" />
      <Rect x={62} y={43} width={9} height={13} fill="none" stroke={theme.text} strokeWidth={LINE} />
      <Rect x={50} y={38} width={8} height={8} fill="none" stroke={theme.text} strokeWidth={LINE} />
      <Rect x={76} y={38} width={8} height={8} fill="none" stroke={theme.text} strokeWidth={LINE} />

      {/* Fence */}
      <Path d="M97 48V56M103 48V56M109 48V56M94 51H112" stroke={theme.text} strokeWidth={LINE} strokeLinecap="round" />
    </Svg>
  );
}

function AfterHouse() {
  const theme = useTheme();

  return (
    <Svg viewBox={VIEW_BOX} style={styles.drawing}>
      {/* Ground */}
      <Path d="M4 56H116" stroke={theme.text} strokeWidth={LINE} strokeLinecap="round" />

      {/* Palm: leaning, two fronds left, one on the ground */}
      <Path d="M22 56Q30 44 37 33" stroke={theme.text} strokeWidth={LINE} strokeLinecap="round" fill="none" />
      <Path
        d="M37 33Q44 31 46 37M37 33Q40 25 46 24M5 55Q12 49 20 53"
        stroke={theme.primaryDeep}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {/* House: same walls and roof, with a tarp over the right side */}
      <Rect x={46} y={32} width={42} height={24} fill={theme.backgroundElement} stroke={theme.text} strokeWidth={LINE} />
      <Path d="M41 32L67 15L93 32Z" fill={theme.primaryDeep} stroke={theme.text} strokeWidth={LINE} strokeLinejoin="round" />
      <Path d="M67 15L84 26L77 32H60Z" fill={theme.warning} stroke={theme.text} strokeWidth={LINE} strokeLinejoin="round" />
      <Rect x={62} y={43} width={9} height={13} fill="none" stroke={theme.text} strokeWidth={LINE} />

      {/* Left window boarded with an X */}
      <Rect x={50} y={38} width={8} height={8} fill="none" stroke={theme.text} strokeWidth={LINE} />
      <Path d="M50 38L58 46M58 38L50 46" stroke={theme.text} strokeWidth={LINE} strokeLinecap="round" />
      <Rect x={76} y={38} width={8} height={8} fill="none" stroke={theme.text} strokeWidth={LINE} />

      {/* Fence: one post standing, the rest down */}
      <Path d="M97 48V56M104 50L108 56M94 51H100M110 55H115" stroke={theme.text} strokeWidth={LINE} strokeLinecap="round" />
    </Svg>
  );
}

export function BeforeAfter() {
  const theme = useTheme();

  return (
    <View style={styles.boxes}>
      <View style={[styles.box, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText themeColor="primaryDeep" style={styles.label}>
          BEFORE · JUN 3
        </ThemedText>
        <BeforeHouse />
      </View>

      <View style={[styles.box, { backgroundColor: theme.warningBackground }]}>
        <ThemedText themeColor="warning" style={styles.label}>
          AFTER · OCT 11
        </ThemedText>
        <AfterHouse />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boxes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  box: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // A fixed height keeps the box short. The canvas is 120 by 62, so the width follows from it.
  drawing: {
    height: 52,
    aspectRatio: 120 / 62,
    alignSelf: 'center',
  },
});
