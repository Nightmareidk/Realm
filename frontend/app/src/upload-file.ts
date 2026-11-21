/**
 * A picked file, ready to send to a signed upload link (the browser preview of the app). Phones
 * use `upload-file.native.ts`, which streams from storage.
 *
 * The body is sent as raw bytes, not a Blob: with a Blob, `fetch` may replace the signed
 * Content-Type with the Blob's own type and the link's signature no longer matches.
 */
export interface PickedFile {
  size: number;
  send(
    url: string,
    headers: Record<string, string>,
    onProgress?: (fraction: number) => void,
  ): Promise<number>;
}

export async function openPickedFile(uri: string): Promise<PickedFile> {
  const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
  if (!bytes.length) throw new Error("That file can't be read. Pick it again.");
  return {
    size: bytes.length,
    async send(url, headers, onProgress) {
      const res = await fetch(url, { method: "PUT", headers, body: bytes });
      onProgress?.(1);
      return res.status;
    },
  };
}
