// Dev-only asset renderer: /render-3d?item=astro-teal draws one 3D asset on a transparent
// background so scripts/render-assets.mjs can capture it into public/art. Not linked anywhere; 404s in production.
import { notFound } from "next/navigation";
import { RenderStage } from "./stage";

export default async function Render3D({ searchParams }: PageProps<"/render-3d">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { item } = await searchParams;
  return (
    <>
      <style>
        {
          "html,body{background:transparent!important}body::before,body::after,.realm-nebula{display:none!important}"
        }
      </style>
      <RenderStage item={typeof item === "string" ? item : "astro-teal"} />
    </>
  );
}
