import type { Metadata } from "next";
import { AdminHome } from "@/features/admin/admin";

// Staff only, and never in search results.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-[72rem] px-5 pt-6 pb-16 md:px-8">
      <h1 className="font-display text-[1.9rem] leading-[1.1] font-bold tracking-[-0.025em] text-fg">
        Admin
      </h1>
      <p className="mt-2 max-w-[60ch] text-fg-soft">
        Accounts, reports, verification and famous names. Every action needs a reason and is kept in
        the staff record.
      </p>
      <div className="mt-8">
        <AdminHome />
      </div>
    </div>
  );
}
