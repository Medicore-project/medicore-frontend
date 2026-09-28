import type { AxiosResponse } from 'axios';

/** A file the service produced, ready to hand to the browser. */
export interface FileDownload {
  blob: Blob;
  fileName: string;
}

/**
 * The file name the service chose, from `Content-Disposition`. The RFC 5987 `filename*` form wins
 * over plain `filename`, as browsers treat it; the fallback is used when the header is missing or
 * unreadable (a proxy may strip it).
 */
export function readDownloadFileName(response: AxiosResponse<Blob>, fallback: string): string {
  const disposition = response.headers?.['content-disposition'];
  if (typeof disposition === 'string') {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (fileNameMatch?.[1]) return fileNameMatch[1];
  }

  return fallback;
}

/**
 * Saves a blob through a temporary link: the only way to name a download the page fetched itself
 * (with the Authorization header a plain link cannot carry).
 */
export function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
