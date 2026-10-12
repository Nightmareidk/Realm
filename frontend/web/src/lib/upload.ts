"use client";

import { MEDIA_RULES, type MediaInfo, type MediaKind, type UploadTicket } from "@realm/contracts";
import { ApiError, api } from "./api";

/** Which upload kind a picked file is (photos and videos by type; anything else is a file). */
export function kindOf(file: File): MediaKind {
  const type = file.type.toLowerCase();
  if ((MEDIA_RULES.image.types as readonly string[]).includes(type)) return "image";
  if ((MEDIA_RULES.video.types as readonly string[]).includes(type)) return "video";
  if ((MEDIA_RULES.audio.types as readonly string[]).includes(type)) return "audio";
  return "file";
}

/** Plain words for a size: "4.2 MB". */
export function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Sends one file: a ticket from Realm, the bytes straight to storage (with progress), then
 * Realm checks what arrived. Resolves with the ready file; rejects with a message to show.
 */
export async function uploadFile(
  file: Blob,
  opts: { kind: MediaKind; filename?: string; durationMs?: number; signal?: AbortSignal },
  onProgress?: (fraction: number) => void,
): Promise<MediaInfo> {
  const rule = MEDIA_RULES[opts.kind];
  if (file.size > rule.maxBytes) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      `That's too big. The limit is ${sizeLabel(rule.maxBytes)}.`,
    );
  }
  const mimeType =
    (file.type || "application/octet-stream").split(";")[0] ?? "application/octet-stream";
  const ticket = await api<UploadTicket>("/media/uploads", {
    body: {
      kind: opts.kind,
      mimeType,
      sizeBytes: file.size,
      ...(opts.filename ? { filename: opts.filename } : {}),
      ...(opts.durationMs !== undefined ? { durationMs: Math.round(opts.durationMs) } : {}),
    },
    signal: opts.signal,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", ticket.uploadUrl);
    for (const [k, v] of Object.entries(ticket.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new ApiError(xhr.status, "UPLOAD_INVALID", "The upload didn't go through. Try again."),
          );
    xhr.onerror = () =>
      reject(new ApiError(0, "NETWORK", "We couldn't reach the upload. Check your connection."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });

  onProgress?.(1);
  return api<MediaInfo>(`/media/${ticket.mediaId}/complete`, {
    method: "POST",
    signal: opts.signal,
  });
}
