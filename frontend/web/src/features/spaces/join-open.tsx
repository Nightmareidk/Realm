"use client";

import { useState } from "react";
import { pill } from "@/components/pill";
import { joinOpenSpace } from "@/features/realtime/actions";
import { ApiError } from "@/lib/api";

/** Join a public Space from Explore, then go into it. */
export function JoinOpenButton({ slug, name }: { slug: string; name: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-disabled={pending || undefined}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setError("");
          try {
            const space = await joinOpenSpace(slug);
            window.location.assign(`/spaces/${space.slug}`);
          } catch (err) {
            setPending(false);
            setError(err instanceof ApiError ? err.message : "Couldn't join. Try again.");
          }
        }}
        className={pill("ghost", "sm")}
      >
        {pending ? "Joining" : "Join"}
        <span className="sr-only"> {name}</span>
      </button>
      {error && (
        <span role="alert" className="max-w-[16rem] text-right text-[0.86rem] text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
