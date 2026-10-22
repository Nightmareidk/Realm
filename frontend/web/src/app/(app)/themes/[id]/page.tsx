import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeView } from "@/features/themes/views";

export const metadata: Metadata = { title: "Theme" };

export default async function ThemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,19}$/.test(id)) notFound();
  return (
    <div className="mx-auto w-full max-w-[76rem] px-5 pt-6 pb-16 md:px-8 md:pt-2">
      <ThemeView id={id} />
    </div>
  );
}
