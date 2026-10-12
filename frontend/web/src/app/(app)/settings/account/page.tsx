import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { textLink } from "@/components/pill";
import { ChangePasswordForm, SignOutButton } from "@/features/settings/account-forms";
import { SettingsPlace, SettingsSection } from "@/features/settings/settings-place";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Account settings" };

const row = "sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-8";

export default async function AccountSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (
    <SettingsPlace title="Account">
      <SettingsSection id="details" title="Your details">
        <dl className="space-y-4">
          <div className={row}>
            <dt className="text-fg-soft">Display name</dt>
            <dd className="font-bold text-fg">{viewer.displayName}</dd>
          </div>
          <div className={row}>
            <dt className="text-fg-soft">Username</dt>
            <dd className="font-bold text-fg">@{viewer.username}</dd>
          </div>
          <div className={row}>
            <dt className="text-fg-soft">Email</dt>
            <dd>
              <span className="font-bold text-fg [overflow-wrap:anywhere]">{viewer.email}</span>
              <span className="mt-1 flex items-center gap-1.5 text-[0.94rem]">
                {viewer.emailVerified ? (
                  <>
                    <CheckCircle
                      aria-hidden="true"
                      size={18}
                      weight="fill"
                      className="text-success"
                    />
                    <span className="text-fg-soft">Verified</span>
                  </>
                ) : (
                  <>
                    <WarningCircle
                      aria-hidden="true"
                      size={18}
                      weight="fill"
                      className="text-fg-soft"
                    />
                    <span className="text-fg-soft">
                      Not verified yet.{" "}
                      <Link href="/verify" className={textLink}>
                        Verify it
                      </Link>
                    </span>
                  </>
                )}
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-[0.94rem] text-fg-soft">
          Changing your name, username and picture comes with profiles.
        </p>
      </SettingsSection>
      <SettingsSection id="password" title="Password">
        <ChangePasswordForm />
      </SettingsSection>
      <SettingsSection id="sign-out" title="Sign out" lead="Sign out of Realm on this device.">
        <SignOutButton />
      </SettingsSection>
    </SettingsPlace>
  );
}
