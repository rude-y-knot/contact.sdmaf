import { cmyk, type CMYK } from 'pdf-lib';

export interface PrintColor {
  name: string;
  hex: string;
  c: number; // 0..100
  m: number; // 0..100
  y: number; // 0..100
  k: number; // 0..100
  pdf: CMYK;
}

function definePrintColor(name: string, hex: string, c: number, m: number, y: number, k: number): PrintColor {
  return {
    name,
    hex,
    c,
    m,
    y,
    k,
    pdf: cmyk(c / 100, m / 100, y / 100, k / 100),
  };
}

/**
 * Brand print palette for «Стальное дело» in DeviceCMYK.
 * All ink sums (TIL) are kept <= 215% for clean offset/digital printing.
 * Small text and QR modules use pure K channel only to avoid registration halos.
 */
export const CMYK_PALETTE = {
  brandGreen: definePrintColor('Фирменный зелёный', '#70B84F', 60, 5, 85, 0),
  brandDarkSolid: definePrintColor('Фирменный графит (плашки/логотип)', '#42444A', 65, 55, 50, 45),
  textDark: definePrintColor('Основной текст (чистый K)', '#33353A', 0, 0, 0, 88),
  textMuted: definePrintColor('Второстепенный текст (чистый K)', '#66686E', 0, 0, 0, 60),
  dividerGray: definePrintColor('Светло-серый разделитель', '#DCDDE0', 0, 0, 0, 14),
  surfaceLight: definePrintColor('Светло-серая подложка', '#EFEFEF', 0, 0, 0, 6),
  paperWhite: definePrintColor('Белый (бумага)', '#FFFFFF', 0, 0, 0, 0),
  qrBlack: definePrintColor('QR-код (100% Black)', '#000000', 0, 0, 0, 100),
  cropMarkBlack: definePrintColor('Метки реза', '#000000', 0, 0, 0, 100),
} as const;

export function formatCmykLabel(color: PrintColor): string {
  return `C:${color.c} M:${color.m} Y:${color.y} K:${color.k}`;
}
