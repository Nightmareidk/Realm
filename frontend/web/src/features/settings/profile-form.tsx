"use client";

import { Camera } from "@phosphor-icons/react";
import { DisplayName, Limits, type SelfUser } from "@realm/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { FormNotice, SubmitButton, TextField } from "@/components/form";
import { pill } from "@/components/pill";
import { Me } from "@/features/app/menus";
import { setState } from "@/features/realtime/store";
import { ApiError, api } from "@/lib/api";
import { uploadFile } from "@/lib/upload";

/** Your picture, name, a short bio and pronouns: what people see beside your messages. */
export function ProfileForm({ viewer }: { viewer: SelfUser }) {
  const router = useRouter();
  const [f, setF] = useState({
    displayName: viewer.displayName,
    bio: viewer.bio ?? "",
    pronouns: viewer.pronouns ?? "",
  });
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [picture, setPicture] = useState<"idle" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const pick = useRef<HTMLInputElement>(null);

  const saved = (user: SelfUser, text: string) => {
    setState((s) => ({ ...s, me: user }));
    setNotice({ tone: "success", text });
    router.refresh();
  };

  const onPicture = async (file: File) => {
    setNotice(null);
    setPicture("uploading");
    try {
      const media = await uploadFile(file, { kind: "image" }, setProgress);
      const user = await api<SelfUser>("/users/@me", {
        method: "PATCH",
        body: { avatarMediaId: media.id },
      });
      saved(user, "Picture updated.");
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Couldn't use that picture.",
      });
    } finally {
      setPicture("idle");
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = DisplayName.safeParse(f.displayName);
    if (!name.success) return setNotice({ tone: "error", text: "Your name can't be empty." });
    setPending(true);
    setNotice(null);
    try {
      const user = await api<SelfUser>("/users/@me", {
        method: "PATCH",
        body: {
          displayName: name.data,
          bio: f.bio.trim() || null,
          pronouns: f.pronouns.trim() || null,
        },
      });
      saved(user, "Saved.");
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Couldn't save. Try again.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
      <div className="flex flex-wrap items-center gap-5">
        <Me name={viewer.displayName} src={viewer.avatarUrl} size={88} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => pick.current?.click()}
              aria-disabled={picture === "uploading" || undefined}
              className={pill("ghost", "md")}
            >
              <Camera aria-hidden="true" size={18} />
              {picture === "uploading"
                ? `Uploading ${Math.round(progress * 100)}%`
                : "Change picture"}
            </button>
            {viewer.avatarUrl && (
              <button
                type="button"
                className={pill("quiet", "md")}
                onClick={async () => {
                  const user = await api<SelfUser>("/users/@me", {
                    method: "PATCH",
                    body: { avatarMediaId: null },
                  });
                  saved(user, "Picture removed.");
                }}
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-[0.9rem] text-fg-soft">
            PNG, JPEG, GIF or WebP, up to 10 MB. Anyone can see it.
          </p>
        </div>
        <input
          ref={pick}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onPicture(file);
          }}
        />
      </div>

      <form noValidate onSubmit={onSubmit} className="max-w-[30rem] space-y-5">
        <TextField
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          maxLength={Limits.displayName.max}
          value={f.displayName}
          onChange={(e) => setF({ ...f, displayName: e.target.value })}
        />
        <TextField
          label="Pronouns"
          hint="Optional, like she/her or they/them."
          name="pronouns"
          maxLength={Limits.pronouns.max}
          value={f.pronouns}
          onChange={(e) => setF({ ...f, pronouns: e.target.value })}
        />
        <div>
          <label htmlFor="bio" className="mb-2 block text-[0.95rem] font-bold text-fg">
            About you
          </label>
          <textarea
            id="bio"
            rows={3}
            maxLength={Limits.bio.max}
            value={f.bio}
            onChange={(e) => setF({ ...f, bio: e.target.value })}
            className="block w-full resize-y rounded-input bg-base/70 px-4 py-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
          />
          <p className="mt-1.5 text-right text-[0.85rem] text-fg-soft">
            {Limits.bio.max - f.bio.length} left
          </p>
        </div>
        <SubmitButton pending={pending} pendingLabel="Saving" size="md">
          Save
        </SubmitButton>
      </form>
    </div>
  );
}
