import type { Place } from "@realm/contracts";
import * as Linking from "expo-linking";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../icon";
import { type NativeTheme, useStyles } from "../theme";

/** OpenStreetMap's own page for a spot: works on any phone or computer, no app needed. */
const osmUrl = (p: Place) =>
  `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&mlon=${p.lng.toFixed(5)}#map=17/${p.lat.toFixed(5)}/${p.lng.toFixed(5)}`;

/** The phone's own maps app at that spot, with the place's name on the pin. */
function mapsUrl(p: Place) {
  const at = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const label = encodeURIComponent(p.name.slice(0, 120));
  if (Platform.OS === "android") return `geo:${at}?q=${at}(${label})`;
  if (Platform.OS === "ios") return `https://maps.apple.com/?ll=${at}&q=${label}`;
  return osmUrl(p);
}

async function openInMaps(p: Place) {
  try {
    await Linking.openURL(mapsUrl(p));
  } catch {
    // No maps app on this phone: the map on the web opens instead.
    await Linking.openURL(osmUrl(p)).catch(() => {});
  }
}

/** A place shared in a chat, once (never a live location): pin, name, address, and a way there. */
export function PlaceCard({ place, ink, soft }: { place: Place; ink: string; soft: string }) {
  const s = useStyles(make);
  return (
    <View style={s.card}>
      <View style={s.top}>
        <View style={[s.pin, { borderColor: ink }]}>
          <Icon name="MapPinFill" size={18} color={ink} />
        </View>
        <View style={s.words}>
          <Text style={[s.name, { color: ink }]} numberOfLines={2}>
            {place.name}
          </Text>
          {place.address ? (
            <Text style={[s.address, { color: soft }]} numberOfLines={2}>
              {place.address}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={() => void openInMaps(place)}
        accessibilityRole="link"
        accessibilityLabel={`Open ${place.name} in Maps`}
        style={({ pressed }) => [s.open, { borderColor: ink }, pressed && s.pressed]}
      >
        <Text style={[s.openText, { color: ink }]}>Open in Maps</Text>
        <Icon name="ArrowSquareOut" size={15} color={ink} />
      </Pressable>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    card: { gap: 10, paddingTop: 2, paddingBottom: 6, minWidth: 200 },
    top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    pin: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.9,
    },
    words: { flex: 1, minWidth: 0 },
    name: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, lineHeight: 21 * t.textScale },
    address: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      marginTop: 1,
    },
    open: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 38,
      borderRadius: 999,
      borderWidth: 1.5,
      paddingHorizontal: 14,
    },
    pressed: { opacity: 0.7 },
    openText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale },
  });
