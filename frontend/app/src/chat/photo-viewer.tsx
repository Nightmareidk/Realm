import { Image, type ImageSource } from "expo-image";
import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../icon";
import { type NativeTheme, useStyles } from "../theme";

/**
 * A photo, full screen, on black: swipe between a message's photos, X to close. A view-once
 * photo shows a countdown along the top and closes itself when it runs out.
 */
export function PhotoViewer({
  photos,
  start = 0,
  seconds,
  note,
  onClose,
}: {
  photos: ImageSource[] | null;
  start?: number;
  /** View once / view twice: how long it stays open. */
  seconds?: number;
  /** A line at the bottom ("You can open this once more"). */
  note?: string;
  onClose: () => void;
}) {
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const left = useSharedValue(1);

  useEffect(() => {
    if (!photos || !seconds) return;
    left.value = 1;
    left.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
    const t = setTimeout(onClose, seconds * 1000);
    return () => {
      clearTimeout(t);
      cancelAnimation(left);
    };
  }, [photos, seconds, onClose, left]);

  const bar = useAnimatedStyle(() => ({ width: `${left.value * 100}%` }));

  return (
    <Modal
      visible={photos !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
    >
      <View style={s.root}>
        {photos ? (
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            initialScrollIndex={start}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image
                source={item}
                style={{ width, height }}
                contentFit="contain"
                transition={120}
              />
            )}
          />
        ) : null}
        <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          {seconds ? (
            <View style={s.track}>
              <Animated.View style={[s.trackFill, bar]} />
            </View>
          ) : null}
          <View style={s.topRow}>
            <Text style={s.count}>
              {photos && photos.length > 1 ? `${index + 1} of ${photos.length}` : ""}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={s.close}
            >
              <Icon name="X" size={26} color="#ffffff" />
            </Pressable>
          </View>
        </View>
        {note ? (
          <Text style={[s.note, { bottom: insets.bottom + 20 }]} accessibilityLiveRegion="polite">
            {note}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000000" },
    top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 12 },
    track: {
      height: 3,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.3)",
      overflow: "hidden",
    },
    trackFill: { height: 3, backgroundColor: "#ffffff" },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    count: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: "#ffffff" },
    close: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    note: {
      position: "absolute",
      left: 20,
      right: 20,
      textAlign: "center",
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: "rgba(255,255,255,0.85)",
    },
  });
