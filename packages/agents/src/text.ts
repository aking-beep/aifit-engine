/**
 * Deterministic checks on model output. Mirrored in Python (aifit.agents);
 * fixtures/*.json pin both to the same answers.
 */

/** Lowercase, straight quotes, single spaces, no surrounding quotes. */
export function normalizeText(s: string): string {
  return s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, '');
}

/** True when `quote` (3+ characters after normalising) appears verbatim in `source`. */
export function quoteAppears(quote: string, source: string): boolean {
  const q = normalizeText(quote);
  return q.length >= 3 && normalizeText(source).includes(q);
}

/** Every number written in `text`, with thousands separators removed. */
export function numbersIn(text: string): number[] {
  return Array.from(text.matchAll(/\d[\d,]*(?:\.\d+)?|\.\d+/g))
    .map((m) => Number(m[0].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n));
}

export function quoteShowsNumber(quote: string, n: number): boolean {
  return numbersIn(quote).some((x) => Math.abs(x - n) < 1e-9);
}

/** Readable text from HTML: scripts, styles and tags removed, entities for the common cases decoded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|p|div|li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** The parts of a long page around each mention of `needle`, so a prompt stays small. */
export function excerptAround(text: string, needle: string, radius = 1500, cap = 12_000): string {
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  const windows: [number, number][] = [];
  for (let i = lower.indexOf(n); i !== -1 && windows.length < 8; i = lower.indexOf(n, i + n.length)) {
    const start = Math.max(0, i - radius);
    const end = Math.min(text.length, i + n.length + radius);
    const last = windows[windows.length - 1];
    if (last && start <= last[1]) last[1] = end;
    else windows.push([start, end]);
  }
  const joined = windows.map(([a, b]) => text.slice(a, b)).join('\n…\n');
  return (joined || text.slice(0, radius * 2)).slice(0, cap);
}
