import type { AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readDownloadFileName, triggerBrowserDownload } from './download';

function withDisposition(value?: string): AxiosResponse<Blob> {
  return { headers: value === undefined ? {} : { 'content-disposition': value } } as AxiosResponse<Blob>;
}

describe('readDownloadFileName', () => {
  it('prefers the UTF-8 form and decodes it', () => {
    const response = withDisposition("attachment; filename=plain.csv; filename*=UTF-8''r%C3%A9port%20one.csv");

    expect(readDownloadFileName(response, 'fallback.csv')).toBe('réport one.csv');
  });

  it('reads a quoted or bare plain file name', () => {
    expect(readDownloadFileName(withDisposition('attachment; filename="a b.pdf"'), 'x')).toBe('a b.pdf');
    expect(readDownloadFileName(withDisposition('attachment; filename=plain.pdf'), 'x')).toBe('plain.pdf');
  });

  it('falls back when the header is missing or names nothing', () => {
    expect(readDownloadFileName(withDisposition(), 'fallback.csv')).toBe('fallback.csv');
    expect(readDownloadFileName(withDisposition('attachment'), 'fallback.csv')).toBe('fallback.csv');
  });
});

describe('triggerBrowserDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('clicks a temporary named link, then removes it and frees the blob url', () => {
    // jsdom has no object URLs, so the two the helper uses are stubbed.
    const createObjectURL = vi.fn(() => 'blob:report');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    triggerBrowserDownload(new Blob(['x']), 'report.csv');

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('report.csv');
    expect(link.href).toBe('blob:report');
    expect(link.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });
});
