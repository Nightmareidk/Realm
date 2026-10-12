import { Accelerometer } from "expo-sensors";
import { useEffect } from "react";
import { type SharedValue, useSharedValue, withSpring } from "react-native-reanimated";

const SPRING = { damping: 20, stiffness: 140, mass: 0.6 } as const;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * How far the phone is tipped away from however it's being held, in degrees, for the card to
 * follow. The resting angle drifts slowly toward the current one, so the card settles at any grip.
 * Off when `enabled` is false (the phone asks for less motion) or there's no sensor.
 */
export function useTilt(enabled: boolean): { x: SharedValue<number>; y: SharedValue<number> } {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      x.value = withSpring(0, SPRING);
      y.value = withSpring(0, SPRING);
      return;
    }
    let sub: { remove(): void } | null = null;
    let base: { x: number; y: number } | null = null;
    let live = true;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || !live) return;
        Accelerometer.setUpdateInterval(40);
        sub = Accelerometer.addListener((a) => {
          if (!base) base = { x: a.x, y: a.y };
          base.x += (a.x - base.x) * 0.012;
          base.y += (a.y - base.y) * 0.012;
          y.value = withSpring(clamp((a.x - base.x) * 70, -16, 16), SPRING);
          x.value = withSpring(clamp((a.y - base.y) * -60, -12, 12), SPRING);
        });
      })
      .catch(() => {});
    return () => {
      live = false;
      sub?.remove();
    };
  }, [enabled, x, y]);

  return { x, y };
}
