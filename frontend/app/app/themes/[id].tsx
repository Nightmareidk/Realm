import {
  resolveTheme,
  type ThemeDetail,
  type ThemeFile,
  type ThemePayments,
} from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSheet } from "@/sheet";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";
import { ThemePreview } from "@/themes/preview";
import { price, themeChoice, useApplyTheme } from "@/themes/use";
import { Pill } from "@/ui";

const REPORTS: [string, string][] = [
  ["not-their-art", "Uses art that isn't theirs"],
  ["offensive", "Hateful or offensive"],
  ["sexual", "Sexual content"],
  ["broken", "Hard to read or broken"],
  ["spam", "Spam"],
  ["scam", "A scam"],
  ["other", "Something else"],
];

const STATUS: Record<ThemeDetail["status"], string> = {
  draft: "Only you can see it",
  published: "In the store",
  hidden: "Hidden after reports. People who have it keep it.",
  removed: "Deleted",
};

/**
 * One theme: a preview, who made it, its rating, and what you can do with it: try it on, get it
 * (or buy it), use it, review it, save its file, or report it. Its maker can edit it, put it in
 * the store or take it out.
 */
export default function ThemePage() {
  const { t, choice, preview, previewing } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const sheet = useSheet();
  const apply = useApplyTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useApi<ThemeDetail>(id ? `/themes/${id}` : null);
  const payments = useApi<ThemePayments>("/themes/payments");
  const [busy, setBusy] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");

  if (!theme.data) {
    return (
      <AppScreen>
        <TopBar title="Theme" />
        {theme.error ? <Problem message={theme.error} onRetry={theme.reload} /> : <Loading />}
      </AppScreen>
    );
  }
  const d = theme.data;
  const resolved = resolveTheme(d.file);
  const using = choice.kind === "theme" && choice.themeId === d.id;

  async function act(label: string, run: () => Promise<void>) {
    setBusy(label);
    try {
      await run();
    } catch (err) {
      Alert.alert("That didn't work", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  const get = () =>
    act("get", async () => {
      theme.setData(await api<ThemeDetail>(`/themes/${d.id}/get`, { method: "POST" }));
      await apply(await themeChoice(d.id));
    });
  const buy = () =>
    act("buy", async () => {
      const { checkoutUrl } = await api<{ checkoutUrl: string }>(`/themes/${d.id}/buy`, {
        method: "POST",
      });
      // Checkout happens on the payment company's page; the theme arrives once it's paid.
      if (/^https:\/\//.test(checkoutUrl)) await Linking.openURL(checkoutUrl);
    });
  const use = () => act("use", async () => apply(await themeChoice(d.id)));
  const drop = () =>
    act("drop", async () => {
      await api(`/themes/${d.id}/library`, { method: "DELETE" });
      theme.reload();
    });
  const publish = (on: boolean) =>
    act("publish", async () => {
      theme.setData(
        await api<ThemeDetail>(`/themes/${d.id}/${on ? "publish" : "unpublish"}`, {
          method: "POST",
        }),
      );
    });
  const saveFile = () =>
    act("file", async () => {
      const { file } = await api<{ file: ThemeFile }>(`/themes/${d.id}/file`);
      await Share.share({ title: `${d.name}.realmtheme`, message: JSON.stringify(file, null, 2) });
    });
  const sendReview = () =>
    act("review", async () => {
      theme.setData(
        await api<ThemeDetail>(`/themes/${d.id}/review`, {
          method: "PUT",
          body: { stars, ...(review.trim() ? { text: review.trim() } : {}) },
        }),
      );
      setReview("");
    });
  const report = () =>
    sheet({
      title: "Report this theme",
      line: "Only Realm sees reports. The maker isn't told who reported.",
      actions: REPORTS.map(([reason, label]) => ({
        label,
        onPress: () =>
          act("report", async () => {
            await api(`/themes/${d.id}/report`, { method: "POST", body: { reason } });
            Alert.alert("Thanks", "We'll take it from here.");
          }),
      })),
    });

  const free = d.priceCents === 0;
  return (
    <AppScreen>
      <TopBar title={d.name} />
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.hero}>
          <ThemePreview theme={resolved} width={190} />
        </View>
        <Text style={s.name} accessibilityRole="header">
          {d.name}
        </Text>
        <Pressable
          onPress={() => router.push(`/user/${d.creator.username}`)}
          accessibilityRole="link"
        >
          <Text style={s.by}>by @{d.creator.username}</Text>
        </Pressable>
        <View style={s.stats}>
          {d.rating ? (
            <View style={s.stat}>
              <Icon name="StarFill" size={15} color={t.colors.text} />
              <Text style={s.statText}>
                {d.rating.toFixed(1)} ({d.ratingCount})
              </Text>
            </View>
          ) : null}
          <Text style={s.statText}>
            {d.installs === 1 ? "1 person uses it" : `${d.installs} people use it`}
          </Text>
          <Text style={s.statText}>Version {d.version}</Text>
        </View>

        <View style={s.buttons}>
          {d.mine ? (
            <>
              <Text style={s.status}>{STATUS[d.status]}</Text>
              <Pill
                label={using ? "Using it now" : "Use it"}
                onPress={use}
                pending={busy === "use"}
                pendingLabel="Switching"
              />
              <Pill
                kind="ghost"
                label="Edit"
                onPress={() => router.push({ pathname: "/themes/studio", params: { id: d.id } })}
              />
              {d.status === "draft" || d.status === "published" ? (
                <Pill
                  kind="ghost"
                  label={
                    d.status === "published" ? "Take it out of the store" : "Share in the store"
                  }
                  onPress={() => publish(d.status !== "published")}
                  pending={busy === "publish"}
                  pendingLabel="Saving"
                />
              ) : null}
            </>
          ) : d.owned ? (
            <>
              <Pill
                label={using ? "Using it now" : "Use this theme"}
                onPress={use}
                pending={busy === "use"}
                pendingLabel="Switching"
              />
              <Pill
                kind="quiet"
                label="Remove from my themes"
                onPress={drop}
                pending={busy === "drop"}
                pendingLabel="Removing"
              />
            </>
          ) : free ? (
            <Pill
              label="Get it, free"
              onPress={get}
              pending={busy === "get"}
              pendingLabel="Adding"
            />
          ) : payments.data?.enabled ? (
            <Pill
              label={`Buy for ${price(d.priceCents)}`}
              onPress={buy}
              pending={busy === "buy"}
              pendingLabel="Opening checkout"
            />
          ) : (
            <Text style={s.status}>
              {`${price(d.priceCents)}. Buying themes isn't switched on yet. Free themes work now.`}
            </Text>
          )}
          {!using ? (
            <Pill
              kind="ghost"
              label={previewing ? "Stop trying it on" : "Try it on"}
              onPress={() => preview(previewing ? null : resolved)}
            />
          ) : null}
        </View>

        {d.description ? <Text style={s.text}>{d.description}</Text> : null}
        {d.tags.length ? (
          <View style={s.tags}>
            {d.tags.map((tag) => (
              <Text key={tag} style={s.tag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}

        {d.versions.length > 1 ? (
          <>
            <Text style={s.heading}>What's new</Text>
            {d.versions.slice(0, 3).map((v) => (
              <Text key={v.number} style={s.text}>
                <Text style={s.bold}>Version {v.number}. </Text>
                {v.changelog ?? "Small changes."}
              </Text>
            ))}
          </>
        ) : null}

        <Text style={s.heading}>Reviews</Text>
        {d.owned && !d.mine ? (
          <View style={s.write}>
            <View style={s.starsRow} accessibilityRole="radiogroup" accessibilityLabel="Your stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setStars(n)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
                  accessibilityState={{ checked: stars === n }}
                  hitSlop={6}
                >
                  <Icon
                    name={n <= (stars || d.myReview?.stars || 0) ? "StarFill" : "Star"}
                    size={28}
                    color={t.colors.text}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={review}
              onChangeText={setReview}
              placeholder={d.myReview?.text ?? "What do you like about it? (optional)"}
              placeholderTextColor={t.colors.textSoft}
              style={s.input}
              maxLength={500}
              multiline
            />
            <Pill
              size="md"
              kind="ghost"
              label={d.myReview ? "Update review" : "Send review"}
              onPress={sendReview}
              pending={busy === "review"}
              pendingLabel="Sending"
            />
          </View>
        ) : null}
        {d.reviews.length ? (
          d.reviews.map((r) => (
            <View key={r.author.id} style={s.review}>
              <Text style={s.bold}>
                @{r.author.username} · {"★".repeat(r.stars)}
              </Text>
              {r.text ? <Text style={s.text}>{r.text}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={s.text}>No reviews yet.</Text>
        )}

        <View style={s.footer}>
          {d.owned || free || d.mine ? (
            <Pressable onPress={saveFile} accessibilityRole="button" style={s.link}>
              <Icon name="DownloadSimple" size={18} color={t.colors.text} />
              <Text style={s.linkText}>Save the theme file</Text>
            </Pressable>
          ) : null}
          {!d.mine ? (
            <Pressable onPress={report} accessibilityRole="button" style={s.link}>
              <Icon name="Flag" size={18} color={t.colors.danger} />
              <Text style={[s.linkText, { color: t.colors.danger }]}>Report this theme</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: 20, paddingBottom: 56 },
    hero: { alignItems: "center", paddingVertical: 20 },
    name: { fontFamily: fonts.display, fontSize: 30, color: t.colors.text, textAlign: "center" },
    by: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: t.colors.textSoft,
      textAlign: "center",
      marginTop: 4,
    },
    stats: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 14,
      marginTop: 10,
    },
    stat: { flexDirection: "row", alignItems: "center", gap: 4 },
    statText: { fontFamily: fonts.body, fontSize: 14, color: t.colors.textSoft },
    buttons: { gap: 10, marginTop: 22 },
    status: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: t.colors.textSoft,
      textAlign: "center",
    },
    heading: {
      fontFamily: fonts.displayBold,
      fontSize: 19,
      color: t.colors.text,
      marginTop: 28,
      marginBottom: 8,
    },
    text: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: t.colors.textSoft,
      marginTop: 8,
    },
    bold: { fontFamily: fonts.bold, color: t.colors.text },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    tag: {
      fontFamily: fonts.bold,
      fontSize: 13,
      color: t.colors.textSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    write: { gap: 10, marginBottom: 12 },
    starsRow: { flexDirection: "row", gap: 8 },
    input: {
      minHeight: 72,
      borderRadius: t.radius.input,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      padding: 12,
      fontFamily: fonts.body,
      fontSize: 15,
      color: t.colors.text,
      textAlignVertical: "top",
    },
    review: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    footer: { marginTop: 28, gap: 6 },
    link: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
    linkText: { fontFamily: fonts.bold, fontSize: 15, color: t.colors.text },
  });
