import {
  resolveTheme,
  type ThemeLook,
  type ThemePage,
  type ThemeSummary,
  type ThemeTag,
} from "@realm/contracts";
import { LOOKS } from "@realm/design-tokens";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles } from "@/theme";
import { ThemePreview } from "@/themes/preview";
import { price } from "@/themes/use";
import { Pill } from "@/ui";

type Sort = "popular" | "new" | "top";
type PriceFilter = "all" | "free" | "paid";
const SORTS: [Sort, string][] = [
  ["popular", "Popular"],
  ["new", "New"],
  ["top", "Top rated"],
];
const PRICES: [PriceFilter, string][] = [
  ["all", "All"],
  ["free", "Free"],
  ["paid", "Paid"],
];
const TAGS: [ThemeTag, string][] = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["colourful", "Colourful"],
  ["cute", "Cute"],
  ["gaming", "Gaming"],
  ["anime", "Anime"],
  ["minimal", "Minimal"],
  ["calm", "Calm"],
  ["bold", "Bold"],
  ["retro", "Retro"],
  ["nature", "Nature"],
  ["music", "Music"],
  ["seasonal", "Seasonal"],
  ["high-contrast", "High contrast"],
];

/**
 * "More themes": the store. Search by name, narrow by look, tag and price, sort by popular, new
 * or top rated. Each card is drawn from the theme itself.
 */
export default function Store() {
  const s = useStyles(make);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [priceFilter, setPrice] = useState<PriceFilter>("all");
  const [look, setLook] = useState<ThemeLook | null>(null);
  const [tag, setTag] = useState<ThemeTag | null>(null);
  const [items, setItems] = useState<ThemeSummary[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(0);

  const load = useCallback(
    async (p: number) => {
      const ticket = ++asked.current;
      setLoading(true);
      const params = new URLSearchParams({ sort, price: priceFilter, page: String(p) });
      if (q.trim()) params.set("q", q.trim());
      if (look) params.set("look", look);
      if (tag) params.set("tag", tag);
      try {
        const res = await api<ThemePage>(`/themes?${params}`);
        if (ticket !== asked.current) return;
        setItems((prev) => (p === 0 ? res.items : [...prev, ...res.items]));
        setMore(res.more);
        setPage(p);
        setError(null);
      } catch (err) {
        if (ticket === asked.current)
          setError(err instanceof ApiError ? err.message : "The store didn't load. Try again.");
      } finally {
        if (ticket === asked.current) setLoading(false);
      }
    },
    [q, sort, priceFilter, look, tag],
  );

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const wait = setTimeout(() => load(0), q ? 300 : 0);
    return () => clearTimeout(wait);
  }, [load, q]);

  const card = Math.floor((width - 16 * 2 - 12) / 2);

  return (
    <AppScreen>
      <TopBar title="More themes" />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={s.gridRow}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={s.search}>
              <Icon name="MagnifyingGlass" size={18} color={s.icon.color} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search themes"
                placeholderTextColor={s.icon.color}
                style={s.searchInput}
                returnKeyType="search"
                accessibilityLabel="Search themes"
                maxLength={60}
              />
            </View>
            <Chips items={SORTS} value={sort} onChange={(v) => setSort(v)} label="Sort" />
            <Chips
              items={[
                ["all", "All looks"],
                ...LOOKS.map((l) => [l.id, l.name] as [string, string]),
              ]}
              value={look ?? "all"}
              onChange={(v) => setLook(v === "all" ? null : (v as ThemeLook))}
              label="Look"
            />
            <Chips items={PRICES} value={priceFilter} onChange={(v) => setPrice(v)} label="Price" />
            <Chips
              items={TAGS}
              value={tag ?? ""}
              onChange={(v) => setTag(v === tag ? null : v)}
              label="Tags"
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/themes/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} by ${item.creator.username}, ${price(item.priceCents)}${item.rating ? `, rated ${item.rating} of 5` : ""}`}
            style={({ pressed }) => [s.card, { width: card }, pressed && s.pressed]}
          >
            <ThemePreview theme={resolveTheme(item.file)} width={card - 16} />
            <Text style={s.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={s.by} numberOfLines={1}>
              @{item.creator.username}
            </Text>
            <View style={s.meta}>
              <Text style={[s.price, item.owned && s.owned]}>
                {item.owned ? "In your themes" : price(item.priceCents)}
              </Text>
              {item.rating ? (
                <View style={s.rating}>
                  <Icon name="StarFill" size={13} color={s.icon.color} />
                  <Text style={s.ratingText}>{item.rating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <Problem message={error} onRetry={() => load(0)} />
          ) : (
            <Empty
              title={
                q || tag || look || priceFilter !== "all" ? "No themes match" : "No themes yet"
              }
              line="Be the first: make a theme and share it."
            >
              <Pill
                kind="ghost"
                size="md"
                label="Make a theme"
                onPress={() => router.push("/themes/studio")}
              />
            </Empty>
          )
        }
        ListFooterComponent={
          more ? (
            <View style={s.more}>
              <Pill
                kind="ghost"
                size="md"
                label="Show more"
                pending={loading}
                pendingLabel="Loading"
                onPress={() => load(page + 1)}
              />
            </View>
          ) : null
        }
      />
    </AppScreen>
  );
}

function Chips<V extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: [V, string][];
  value: string;
  onChange: (v: V) => void;
  label: string;
}) {
  const s = useStyles(make);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chips}
      accessibilityLabel={label}
    >
      {items.map(([v, text]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && s.chipOn]}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{text}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: 16, paddingBottom: 48 },
    gridRow: { gap: 12 },
    icon: { color: t.colors.textSoft },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 48,
      borderRadius: 24,
      paddingHorizontal: 16,
      backgroundColor: t.colors.surfaceRaised,
      marginTop: 14,
      marginBottom: 6,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 16,
      color: t.colors.text,
      height: 48,
    },
    chips: { gap: 8, paddingVertical: 6 },
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    chipOn: { backgroundColor: t.colors.text, borderColor: t.colors.text },
    chipText: { fontFamily: fonts.bold, fontSize: 14, color: t.colors.textSoft },
    chipTextOn: { color: t.colors.bg },
    card: {
      padding: 8,
      borderRadius: t.radius.box,
      backgroundColor: t.colors.surface,
      marginTop: 12,
      gap: 2,
    },
    pressed: { opacity: 0.8 },
    name: { fontFamily: fonts.bold, fontSize: 15, color: t.colors.text, marginTop: 8 },
    by: { fontFamily: fonts.body, fontSize: 13, color: t.colors.textSoft },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    price: { fontFamily: fonts.bold, fontSize: 14, color: t.colors.text },
    owned: { color: t.colors.textSoft },
    rating: { flexDirection: "row", alignItems: "center", gap: 3 },
    ratingText: { fontFamily: fonts.bold, fontSize: 13, color: t.colors.textSoft },
    more: { alignItems: "center", paddingVertical: 20 },
  });
