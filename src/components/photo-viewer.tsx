// Full-screen photo viewer opened by tapping a document's hero photo — pinch to zoom,
// drag to pan once zoomed, double-tap to toggle zoom, swipe to move between photos.
// Always black-on-white text here, not ThemedText — this is a dedicated overlay over a
// black background, not a themed app screen.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
// How far a drag has to travel, at rest zoom, to count as "swipe to the next photo"
// rather than "put the photo back where it was."
const SWIPE_THRESHOLD = 80;
// A dismiss is a bigger, more deliberate motion than a page swipe, so it gets its own,
// larger threshold.
const DISMISS_THRESHOLD = 120;

type PhotoViewerProps = {
  photos: string[];
  index: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
  // One per photo, shown in place of the "1 / 2" count (e.g. "Before · Aug 8, 2012").
  labels?: string[];
};

export function PhotoViewer({ photos, index, onChangeIndex, onClose, labels }: PhotoViewerProps) {
  let counterText: string | null = null;
  if (labels !== undefined) {
    counterText = labels[index];
  } else if (photos.length > 1) {
    counterText = `${index + 1} / ${photos.length}`;
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <ZoomablePhoto
          key={photos[index]}
          uri={photos[index]}
          onSwipeLeft={() => {
            if (index < photos.length - 1) {
              onChangeIndex(index + 1);
            }
          }}
          onSwipeRight={() => {
            if (index > 0) {
              onChangeIndex(index - 1);
            }
          }}
          onDismiss={onClose}
        />

        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        {counterText !== null && (
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>{counterText}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ZoomablePhoto({
  uri,
  onSwipeLeft,
  onSwipeRight,
  onDismiss,
}: {
  uri: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Keeps a zoomed photo from panning past its own edge — a rough bound based on how
  // much bigger than the screen the scaled photo is, not its exact rendered size.
  function clamp(value: number, currentScale: number, dimension: number) {
    "worklet";
    const maxOffset = (dimension * (currentScale - 1)) / 2;
    return Math.min(Math.max(value, -maxOffset), maxOffset);
  }

  function resetZoom() {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        resetZoom();
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = clamp(savedTranslateX.value + event.translationX, scale.value, screenWidth);
        translateY.value = clamp(savedTranslateY.value + event.translationY, scale.value, screenHeight);
      } else {
        // At rest, the drag just follows the finger — onEnd decides whether it was a
        // horizontal page-swipe, a vertical dismiss, or neither.
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (scale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        return;
      }

      const isVertical = Math.abs(event.translationY) > Math.abs(event.translationX);

      if (isVertical && event.translationY > DISMISS_THRESHOLD) {
        runOnJS(onDismiss)();
        return;
      }

      if (!isVertical && event.translationX < -SWIPE_THRESHOLD) {
        runOnJS(onSwipeLeft)();
      } else if (!isVertical && event.translationX > SWIPE_THRESHOLD) {
        runOnJS(onSwipeRight)();
      }
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
        return;
      }
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      savedScale.value = DOUBLE_TAP_SCALE;
    });

  // Race, not Exclusive — a real drag activates on movement and wins immediately, rather
  // than waiting for double-tap's own timeout to rule itself out first. That wait was
  // exactly what made panning feel laggy. Pinch runs alongside whichever of those wins.
  const gesture = Gesture.Simultaneous(pinchGesture, Gesture.Race(panGesture, doubleTapGesture));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  // The transform lives on this plain wrapping View, not on the image itself — a
  // native image view (expo-image does its own caching/decoding under the hood) is
  // heavier to push a transform through every frame than a bare View recompositing an
  // already-rendered layer. That mismatch, not photo resolution, was the real cause of
  // the pinch/pan choppiness.
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.photoContainer, animatedStyle]}>
        <ExpoImage source={{ uri }} style={styles.photo} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  photoContainer: {
    flex: 1,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  counter: {
    position: "absolute",
    bottom: 44,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
