import { Limits, type SelfUser } from "@realm/contracts";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, api, upload } from "@/server";
import { useSession } from "@/session";
import { shrinkPhoto } from "@/shrink";
import { Avatar } from "@/social/avatar";
import { AppScreen, TopBar } from "@/social/screen";
import { fonts, roles } from "@/theme";
import { Field, Notice, Pill } from "@/ui";

/** Your picture, name, @handle, bio and pronouns. */
export default function EditProfile() {
  const router = useRouter();
  const { session, refreshUser } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const [name, setName] = useState(me?.displayName ?? "");
  const [username, setUsername] = useState(me?.username ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [pronouns, setPronouns] = useState(me?.pronouns ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picture, setPicture] = useState<string | null>(null);
  if (!me) return null;

  async function changePicture() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setPicture("Uploading");
    try {
      const small = await shrinkPhoto(a);
      const id = await upload({ uri: small.uri, kind: "image", mimeType: small.mimeType });
      await api<SelfUser>("/users/@me", { method: "PATCH", body: { avatarMediaId: id } });
      await refreshUser();
      setPicture(null);
    } catch (err) {
      setPicture(null);
      Alert.alert("Picture not changed", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      await api<SelfUser>("/users/@me", {
        method: "PATCH",
        body: {
          displayName: name.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim() || null,
          pronouns: pronouns.trim() || null,
        },
      });
      await refreshUser();
      router.back();
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError) {
        const fe = { ...err.fields };
        if (err.code === "USERNAME_TAKEN") fe.username = "That username is taken. Try another.";
        if (err.code === "USERNAME_RESERVED")
          fe.username = "That username isn't available. Try another.";
        setErrors(fe);
        if (!Object.keys(fe).length) setNotice(err.message);
      } else setNotice("Something went wrong. Try again.");
    }
  }

  return (
    <AppScreen>
      <TopBar title="Edit profile" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.pic}>
            <Avatar user={me} size={96} />
            <Pressable
              onPress={changePicture}
              accessibilityRole="button"
              style={s.change}
              disabled={Boolean(picture)}
            >
              <Text style={s.changeText}>{picture ? "Uploading…" : "Change picture"}</Text>
            </Pressable>
          </View>
          {notice ? <Notice>{notice}</Notice> : null}
          <Field
            label="Display name"
            value={name}
            onChangeText={setName}
            error={errors.displayName}
            maxLength={Limits.displayName.max}
          />
          <Field
            label="Username"
            hint="Your @handle: letters, numbers, underscores and single dots."
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={Limits.username.max}
          />
          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            error={errors.bio}
            multiline
            maxLength={Limits.bio.max}
            style={s.bio}
          />
          <Field
            label="Pronouns"
            value={pronouns}
            onChangeText={setPronouns}
            maxLength={Limits.pronouns.max}
          />
          <Pill label="Save" pending={saving} pendingLabel="Saving" onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 20 },
  pic: { alignItems: "center", gap: 6, marginTop: 6 },
  change: { minHeight: 44, justifyContent: "center" },
  changeText: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
    color: roles.text,
    textDecorationLine: "underline",
  },
  bio: { minHeight: 90, textAlignVertical: "top", paddingTop: 14 },
});
