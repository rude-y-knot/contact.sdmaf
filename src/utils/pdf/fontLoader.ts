import * as opentype from 'opentype.js';

export type FontWeightKey = 'regular' | 'medium' | 'bold';

export interface LoadedPrintFonts {
  buffers: Record<FontWeightKey, ArrayBuffer>;
  opentypeFonts: Record<FontWeightKey, opentype.Font>;
}

const FONT_URLS: Record<FontWeightKey, string> = {
  regular: '/fonts/IBMPlexSans-Regular.ttf',
  medium: '/fonts/IBMPlexSans-Medium.ttf',
  bold: '/fonts/IBMPlexSans-Bold.ttf',
};

let cachedPromise: Promise<LoadedPrintFonts> | null = null;

export function loadPrintFonts(): Promise<LoadedPrintFonts> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const entries = await Promise.all(
      (Object.keys(FONT_URLS) as FontWeightKey[]).map(async (weight) => {
        const res = await fetch(FONT_URLS[weight]);
        if (!res.ok) {
          throw new Error(`Не удалось загрузить шрифт ${FONT_URLS[weight]} (${res.status})`);
        }
        const buffer = await res.arrayBuffer();
        const otFont = opentype.parse(buffer.slice(0));
        return [weight, buffer, otFont] as const;
      })
    );

    const buffers = {} as Record<FontWeightKey, ArrayBuffer>;
    const opentypeFonts = {} as Record<FontWeightKey, opentype.Font>;

    for (const [weight, buffer, otFont] of entries) {
      buffers[weight] = buffer;
      opentypeFonts[weight] = otFont;
    }

    return { buffers, opentypeFonts };
  })();

  cachedPromise.catch(() => {
    cachedPromise = null;
  });

  return cachedPromise;
}

export function measureTextWidthPt(
  font: opentype.Font,
  text: string,
  fontSizePt: number
): number {
  return font.getAdvanceWidth(text, fontSizePt);
}

export function textToSvgPathData(
  font: opentype.Font,
  text: string,
  fontSizePt: number
): string {
  const path = font.getPath(text, 0, 0, fontSizePt);
  return path.toPathData(2);
}

export function wrapTextToWidthPt(
  font: opentype.Font,
  text: string,
  fontSizePt: number,
  maxWidthPt: number,
  maxLines = 2
): { lines: string[]; overflowed: boolean } {
  const clean = text.trim();
  if (!clean) return { lines: [], overflowed: false };

  if (measureTextWidthPt(font, clean, fontSizePt) <= maxWidthPt) {
    return { lines: [clean], overflowed: false };
  }

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureTextWidthPt(font, candidate, fontSizePt) <= maxWidthPt) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        lines.push(word);
        current = '';
      }
    }
  }
  if (current) lines.push(current);

  const overflowed =
    lines.length > maxLines ||
    lines.some((line) => measureTextWidthPt(font, line, fontSizePt) > maxWidthPt + 0.5);

  return {
    lines: lines.slice(0, maxLines),
    overflowed,
  };
}
