import { File, UploadTask, UploadType } from "expo-file-system";

/**
 * A picked photo, video or sound, ready to send to a signed upload link (phones).
 *
 * The bytes go straight from the phone's storage to the link, never through JavaScript. This
 * matters twice: a long video would not fit in memory, and Expo's `fetch` swaps the
 * Content-Type of a file body for the file's own (often empty) type, which breaks the link's
 * signature (R2 answers 403). Here the request carries exactly the headers the server signed.
 */
export interface PickedFile {
  size: number;
  /** Sends the file and returns the HTTP status (a network failure throws). */
  send(
    url: string,
    headers: Record<string, string>,
    onProgress?: (fraction: number) => void,
  ): Promise<number>;
}

export async function openPickedFile(uri: string): Promise<PickedFile> {
  const file = new File(uri);
  const size = file.size;
  if (!file.exists || !size) throw new Error("That file can't be read. Pick it again.");
  return {
    size,
    async send(url, headers, onProgress) {
      const task = new UploadTask(file, url, {
        httpMethod: "PUT",
        uploadType: UploadType.BINARY_CONTENT,
        headers,
        sessionType: "foreground",
        ...(onProgress
          ? {
              onProgress: ({ bytesSent, totalBytes }) =>
                onProgress(totalBytes > 0 ? bytesSent / totalBytes : 0),
            }
          : {}),
      });
      const res = await task.uploadAsync();
      return res.status;
    },
  };
}
