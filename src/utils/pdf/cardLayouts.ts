import type { CompanySettings, Employee, PdfCardConfig } from '../../types';
import type { CMYK_PALETTE } from './cmykPalette';
import type { FontWeightKey, LoadedPrintFonts } from './fontLoader';
import { measureTextWidthPt, wrapTextToWidthPt } from './fontLoader';
import { LOGO_FULL_VIEWBOX, LOGO_MARK_VIEWBOX } from './logoGeometry';
import { buildQrPayload } from './qrVector';

export const MM_TO_PT = 72 / 25.4;
export const PT_TO_MM = 25.4 / 72;

export type PaletteKey = keyof typeof CMYK_PALETTE;

export interface LayoutRect {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  colorKey: PaletteKey;
  extendsToBleed?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

export interface LayoutLogo {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  variant: 'full' | 'mark';
  inverted?: boolean;
}

export interface LayoutQr {
  xMm: number;
  yMm: number;
  sizeMm: number;
  quietZoneMm: number;
  payload: string;
  withBorder?: boolean;
}

export interface LayoutText {
  xMm: number;
  baselineYMm: number;
  text: string;
  fontSizePt: number;
  weight: FontWeightKey;
  colorKey: PaletteKey;
  align: 'left' | 'center' | 'right';
  maxWidthMm: number;
  overflowed?: boolean;
}

export interface BuiltCardPage {
  side: 'front' | 'back';
  trimWidthMm: number;
  trimHeightMm: number;
  safeMarginMm: number;
  background: PaletteKey;
  rects: LayoutRect[];
  logos: LayoutLogo[];
  qrs: LayoutQr[];
  texts: LayoutText[];
}

export function resolveEffectiveEmployee(
  base: Employee,
  overrides: Partial<Employee>,
  settings: CompanySettings
): Employee {
  return {
    ...base,
    ...overrides,
    website: (overrides.website ?? base.website) || settings.companyWebsite,
    address: (overrides.address ?? base.address) || settings.companyAddress,
  };
}

function getLogoHeightMm(widthMm: number, variant: 'full' | 'mark'): number {
  const vb = variant === 'full' ? LOGO_FULL_VIEWBOX : LOGO_MARK_VIEWBOX;
  return (widthMm * vb.height) / vb.width;
}

function estimateTextWidthPt(
  text: string,
  fontSizePt: number,
  weight: FontWeightKey,
  fonts?: LoadedPrintFonts
): number {
  if (fonts) {
    return measureTextWidthPt(fonts.opentypeFonts[weight], text, fontSizePt);
  }
  const factor = weight === 'bold' ? 0.58 : weight === 'medium' ? 0.55 : 0.53;
  return text.length * fontSizePt * factor;
}

function wrapTextMm(
  text: string,
  fontSizePt: number,
  weight: FontWeightKey,
  maxWidthMm: number,
  maxLines: number,
  fonts?: LoadedPrintFonts
): { lines: string[]; overflowed: boolean } {
  const maxWidthPt = maxWidthMm * MM_TO_PT;
  if (fonts) {
    return wrapTextToWidthPt(fonts.opentypeFonts[weight], text, fontSizePt, maxWidthPt, maxLines);
  }

  const clean = text.trim();
  if (!clean) return { lines: [], overflowed: false };
  if (estimateTextWidthPt(clean, fontSizePt, weight) <= maxWidthPt) {
    return { lines: [clean], overflowed: false };
  }

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidthPt(candidate, fontSizePt, weight) <= maxWidthPt) {
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
    lines.some((line) => estimateTextWidthPt(line, fontSizePt, weight) > maxWidthPt + 1);
  return { lines: lines.slice(0, maxLines), overflowed };
}

function buildContactLines(
  emp: Employee,
  settings: CompanySettings,
  config: PdfCardConfig
): Array<{ text: string; muted?: boolean }> {
  const lines: Array<{ text: string; muted?: boolean }> = [];
  const personalPhone = emp.phone?.trim() || '';
  const companyPhone = settings.companyPhone?.trim() || '';

  if (config.visibility.showPersonalPhone && personalPhone) {
    lines.push({ text: personalPhone });
  } else if (config.visibility.showPersonalPhone && !personalPhone && companyPhone) {
    // Fallback to company phone when employee has no personal number (e.g. Сергей Сероев)
    lines.push({ text: `${companyPhone} (офис)` });
  }

  if (
    config.visibility.showCompanyPhone &&
    companyPhone &&
    personalPhone &&
    companyPhone !== personalPhone
  ) {
    lines.push({ text: `Офис: ${companyPhone}` });
  }

  if (config.visibility.showEmail && emp.email?.trim()) {
    lines.push({ text: emp.email.trim() });
  }

  if (config.visibility.showTelegram && emp.telegram?.trim()) {
    const handle = emp.telegram.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
    if (handle) {
      lines.push({ text: `t.me/${handle}` });
    }
  }

  if (config.visibility.showWebsite && emp.website?.trim()) {
    lines.push({ text: emp.website.trim().replace(/^https?:\/\//i, '') });
  }

  return lines;
}

export function buildCardPages(
  rawEmployee: Employee,
  settings: CompanySettings,
  config: PdfCardConfig,
  fonts?: LoadedPrintFonts
): BuiltCardPage[] {
  const emp = resolveEffectiveEmployee(rawEmployee, config.overrides, settings);
  const qrPayload = buildQrPayload(emp, settings, config.qrMode);
  const isHorizontal = config.orientation === 'horizontal';
  const trimWidthMm = isHorizontal ? 90 : 50;
  const trimHeightMm = isHorizontal ? 50 : 90;
  const safeMarginMm = 4;

  if (isHorizontal) {
    return buildHorizontalPages(emp, settings, config, qrPayload, trimWidthMm, trimHeightMm, safeMarginMm, fonts);
  }
  return buildVerticalPages(emp, settings, config, qrPayload, trimWidthMm, trimHeightMm, safeMarginMm, fonts);
}

function buildHorizontalPages(
  emp: Employee,
  settings: CompanySettings,
  config: PdfCardConfig,
  qrPayload: string,
  trimWidthMm: number,
  trimHeightMm: number,
  safeMarginMm: number,
  fonts?: LoadedPrintFonts
): BuiltCardPage[] {
  const pages: BuiltCardPage[] = [];
  const isMinimal = config.template === 'minimal-grid';
  const isDouble = config.sides === 'double';

  // ==================== FRONT SIDE (90x50) ====================
  const frontRects: LayoutRect[] = [];
  const frontLogos: LayoutLogo[] = [];
  const frontQrs: LayoutQr[] = [];
  const frontTexts: LayoutText[] = [];

  if (isMinimal) {
    frontRects.push({
      xMm: 0,
      yMm: 0,
      wMm: 1.6,
      hMm: trimHeightMm,
      colorKey: 'brandGreen',
      extendsToBleed: { left: true, top: true, bottom: true },
    });
  } else {
    frontRects.push({
      xMm: 0,
      yMm: 0,
      wMm: trimWidthMm,
      hMm: 1.8,
      colorKey: 'brandGreen',
      extendsToBleed: { top: true, left: true, right: true },
    });
  }

  const leftX = isMinimal ? 6.5 : 5.5;
  const contentMaxWidthMm = isDouble ? 78 : 55.5;

  // Brand logo top-left
  const logoW = isDouble ? 32 : 29;
  const logoH = getLogoHeightMm(logoW, 'full');
  frontLogos.push({
    xMm: leftX,
    yMm: isMinimal ? 5.2 : 5.6,
    wMm: logoW,
    hMm: logoH,
    variant: 'full',
  });

  // Subtle divider line on minimal or double-sided
  if (isDouble) {
    frontRects.push({
      xMm: leftX,
      yMm: 15.8,
      wMm: 10,
      hMm: 0.55,
      colorKey: 'brandGreen',
    });
  } else if (isMinimal) {
    frontRects.push({
      xMm: 63,
      yMm: 5.5,
      wMm: 0.25,
      hMm: 39,
      colorKey: 'dividerGray',
    });
  }

  // Name
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  let nameFontSize = isDouble ? 11.5 : 10.2;
  if (estimateTextWidthPt(fullName, nameFontSize, 'bold', fonts) > contentMaxWidthMm * MM_TO_PT) {
    nameFontSize = isDouble ? 10.2 : 9.2;
  }
  const nameWrapped = wrapTextMm(fullName, nameFontSize, 'bold', contentMaxWidthMm, 2, fonts);
  let cursorY = isDouble ? 21.4 : 19.6;

  nameWrapped.lines.forEach((line, idx) => {
    frontTexts.push({
      xMm: leftX,
      baselineYMm: cursorY + idx * (nameFontSize * PT_TO_MM * 1.18),
      text: line,
      fontSizePt: nameFontSize,
      weight: 'bold',
      colorKey: 'textDark',
      align: 'left',
      maxWidthMm: contentMaxWidthMm,
      overflowed: nameWrapped.overflowed,
    });
  });

  cursorY += (nameWrapped.lines.length - 1) * (nameFontSize * PT_TO_MM * 1.18) + (isDouble ? 4.0 : 3.6);

  // Title
  const titleFontSize = isDouble ? 7.6 : 7.0;
  const titleWrapped = wrapTextMm(emp.title, titleFontSize, 'medium', contentMaxWidthMm, 2, fonts);
  titleWrapped.lines.forEach((line, idx) => {
    frontTexts.push({
      xMm: leftX,
      baselineYMm: cursorY + idx * 3.0,
      text: line,
      fontSizePt: titleFontSize,
      weight: 'medium',
      colorKey: 'textMuted',
      align: 'left',
      maxWidthMm: contentMaxWidthMm,
      overflowed: titleWrapped.overflowed,
    });
  });
  cursorY += (titleWrapped.lines.length - 1) * 3.0;

  if (config.visibility.showDepartment && emp.department) {
    cursorY += 3.0;
    frontTexts.push({
      xMm: leftX,
      baselineYMm: cursorY,
      text: emp.department,
      fontSizePt: 6.2,
      weight: 'medium',
      colorKey: 'brandGreen',
      align: 'left',
      maxWidthMm: contentMaxWidthMm,
    });
  }

  // Contact lines positioned cleanly toward bottom of Safe Zone (46mm)
  const contactLines = buildContactLines(emp, settings, config);
  const contactFontSize = isDouble ? 7.4 : 6.8;
  const contactStepMm = isDouble ? 3.4 : 3.15;

  const addressLines =
    config.visibility.showAddress && emp.address?.trim()
      ? wrapTextMm(emp.address.trim(), 5.7, 'regular', contentMaxWidthMm, 2, fonts)
      : { lines: [], overflowed: false };

  const addressHeightMm = addressLines.lines.length > 0 ? addressLines.lines.length * 2.4 + 0.8 : 0;
  const contactsHeightMm = contactLines.length * contactStepMm;
  const bottomLimitMm = 45.4;
  let contactStartY = Math.max(cursorY + 3.6, bottomLimitMm - addressHeightMm - contactsHeightMm + contactStepMm * 0.7);

  contactLines.forEach((item, idx) => {
    const wrapped = wrapTextMm(item.text, contactFontSize, idx === 0 ? 'medium' : 'regular', contentMaxWidthMm, 1, fonts);
    frontTexts.push({
      xMm: leftX,
      baselineYMm: contactStartY + idx * contactStepMm,
      text: wrapped.lines[0] || item.text,
      fontSizePt: contactFontSize,
      weight: idx === 0 ? 'medium' : 'regular',
      colorKey: 'textDark',
      align: 'left',
      maxWidthMm: contentMaxWidthMm,
      overflowed: wrapped.overflowed,
    });
  });

  if (addressLines.lines.length > 0) {
    const addrStartY = bottomLimitMm - (addressLines.lines.length - 1) * 2.4;
    addressLines.lines.forEach((line, idx) => {
      frontTexts.push({
        xMm: leftX,
        baselineYMm: addrStartY + idx * 2.4,
        text: line,
        fontSizePt: 5.7,
        weight: 'regular',
        colorKey: 'textMuted',
        align: 'left',
        maxWidthMm: contentMaxWidthMm,
        overflowed: addressLines.overflowed,
      });
    });
  }

  // Single-sided QR aligned to the top line (flush with logo top edge)
  if (!isDouble) {
    const qrSizeMm = 21;
    const qrX = 63.5;
    const qrY = isMinimal ? 5.2 : 5.6;
    frontQrs.push({
      xMm: qrX,
      yMm: qrY,
      sizeMm: qrSizeMm,
      quietZoneMm: 1.4,
      payload: qrPayload,
      withBorder: true,
    });
  }

  pages.push({
    side: 'front',
    trimWidthMm,
    trimHeightMm,
    safeMarginMm,
    background: 'paperWhite',
    rects: frontRects,
    logos: frontLogos,
    qrs: frontQrs,
    texts: frontTexts,
  });

  // ==================== BACK SIDE (90x50, DOUBLE-SIDED) ====================
  if (isDouble) {
    const isDarkBack = config.template === 'contrast-back';
    const backRects: LayoutRect[] = [];
    const backLogos: LayoutLogo[] = [];
    const backQrs: LayoutQr[] = [];
    const backTexts: LayoutText[] = [];

    backRects.push({
      xMm: 0,
      yMm: trimHeightMm - 1.8,
      wMm: trimWidthMm,
      hMm: 1.8,
      colorKey: 'brandGreen',
      extendsToBleed: { bottom: true, left: true, right: true },
    });

    const backLogoW = 42;
    const backLogoH = getLogoHeightMm(backLogoW, 'full');
    backLogos.push({
      xMm: 7.5,
      yMm: 7.5,
      wMm: backLogoW,
      hMm: backLogoH,
      variant: 'full',
      inverted: isDarkBack,
    });

    backTexts.push({
      xMm: 7.5,
      baselineYMm: 29.5,
      text: settings.companyWebsite.replace(/^https?:\/\//i, ''),
      fontSizePt: 8.2,
      weight: 'bold',
      colorKey: isDarkBack ? 'paperWhite' : 'textDark',
      align: 'left',
      maxWidthMm: 45,
    });

    backTexts.push({
      xMm: 7.5,
      baselineYMm: 33.8,
      text: settings.companyPhone,
      fontSizePt: 7.4,
      weight: 'medium',
      colorKey: isDarkBack ? 'brandGreen' : 'textMuted',
      align: 'left',
      maxWidthMm: 45,
    });

    const backAddr = wrapTextMm(settings.companyAddress, 5.8, 'regular', 45, 2, fonts);
    backAddr.lines.forEach((line, idx) => {
      backTexts.push({
        xMm: 7.5,
        baselineYMm: 38.2 + idx * 2.5,
        text: line,
        fontSizePt: 5.8,
        weight: 'regular',
        colorKey: isDarkBack ? 'dividerGray' : 'textMuted',
        align: 'left',
        maxWidthMm: 45,
        overflowed: backAddr.overflowed,
      });
    });

    const backQrSize = 24;
    const backQrX = 58.5;
    const backQrY = 7.5;

    backQrs.push({
      xMm: backQrX,
      yMm: backQrY,
      sizeMm: backQrSize,
      quietZoneMm: 1.8,
      payload: qrPayload,
      withBorder: !isDarkBack,
    });

    pages.push({
      side: 'back',
      trimWidthMm,
      trimHeightMm,
      safeMarginMm,
      background: isDarkBack ? 'brandDarkSolid' : 'paperWhite',
      rects: backRects,
      logos: backLogos,
      qrs: backQrs,
      texts: backTexts,
    });
  }

  return pages;
}

function buildVerticalPages(
  emp: Employee,
  settings: CompanySettings,
  config: PdfCardConfig,
  qrPayload: string,
  trimWidthMm: number,
  trimHeightMm: number,
  safeMarginMm: number,
  fonts?: LoadedPrintFonts
): BuiltCardPage[] {
  const pages: BuiltCardPage[] = [];
  const isDouble = config.sides === 'double';
  const isMinimal = config.template === 'minimal-grid';
  const centerX = trimWidthMm / 2;
  const maxWidthMm = 41;

  // ==================== FRONT SIDE (50x90) ====================
  const frontRects: LayoutRect[] = [];
  const frontLogos: LayoutLogo[] = [];
  const frontQrs: LayoutQr[] = [];
  const frontTexts: LayoutText[] = [];

  if (isMinimal) {
    frontRects.push({
      xMm: 0,
      yMm: 0,
      wMm: 1.5,
      hMm: trimHeightMm,
      colorKey: 'brandGreen',
      extendsToBleed: { left: true, top: true, bottom: true },
    });
  } else {
    frontRects.push({
      xMm: 0,
      yMm: 0,
      wMm: trimWidthMm,
      hMm: 2.0,
      colorKey: 'brandGreen',
      extendsToBleed: { top: true, left: true, right: true },
    });
  }

  const logoW = 34;
  const logoH = getLogoHeightMm(logoW, 'full');
  frontLogos.push({
    xMm: (trimWidthMm - logoW) / 2,
    yMm: 7.2,
    wMm: logoW,
    hMm: logoH,
    variant: 'full',
  });

  frontRects.push({
    xMm: centerX - 6,
    yMm: 18.8,
    wMm: 12,
    hMm: 0.55,
    colorKey: 'brandGreen',
  });

  // Name
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  const nameFontSize = isDouble ? 11.2 : 10.2;
  const nameWrapped = wrapTextMm(fullName, nameFontSize, 'bold', maxWidthMm, 2, fonts);
  let cursorY = isDouble ? 27.5 : 25.0;

  nameWrapped.lines.forEach((line, idx) => {
    frontTexts.push({
      xMm: centerX,
      baselineYMm: cursorY + idx * (nameFontSize * PT_TO_MM * 1.22),
      text: line,
      fontSizePt: nameFontSize,
      weight: 'bold',
      colorKey: 'textDark',
      align: 'center',
      maxWidthMm,
      overflowed: nameWrapped.overflowed,
    });
  });

  cursorY += (nameWrapped.lines.length - 1) * (nameFontSize * PT_TO_MM * 1.22) + 4.0;

  const titleFontSize = isDouble ? 7.8 : 7.0;
  const titleWrapped = wrapTextMm(emp.title, titleFontSize, 'medium', maxWidthMm, 2, fonts);
  titleWrapped.lines.forEach((line, idx) => {
    frontTexts.push({
      xMm: centerX,
      baselineYMm: cursorY + idx * 3.1,
      text: line,
      fontSizePt: titleFontSize,
      weight: 'medium',
      colorKey: 'textMuted',
      align: 'center',
      maxWidthMm,
      overflowed: titleWrapped.overflowed,
    });
  });
  cursorY += (titleWrapped.lines.length - 1) * 3.1;

  if (config.visibility.showDepartment && emp.department) {
    cursorY += 3.2;
    frontTexts.push({
      xMm: centerX,
      baselineYMm: cursorY,
      text: emp.department,
      fontSizePt: 6.2,
      weight: 'medium',
      colorKey: 'brandGreen',
      align: 'center',
      maxWidthMm,
    });
  }

  const contactLines = buildContactLines(emp, settings, config);
  const contactFontSize = isDouble ? 7.6 : 6.7;
  const contactStepMm = isDouble ? 4.2 : 3.4;
  let contactY = Math.max(cursorY + (isDouble ? 8.5 : 4.8), isDouble ? 46 : 38.5);

  contactLines.forEach((item, idx) => {
    const wrapped = wrapTextMm(item.text, contactFontSize, idx === 0 ? 'medium' : 'regular', maxWidthMm, 1, fonts);
    frontTexts.push({
      xMm: centerX,
      baselineYMm: contactY + idx * contactStepMm,
      text: wrapped.lines[0] || item.text,
      fontSizePt: contactFontSize,
      weight: idx === 0 ? 'medium' : 'regular',
      colorKey: 'textDark',
      align: 'center',
      maxWidthMm,
      overflowed: wrapped.overflowed,
    });
  });

  if (isDouble) {
    if (config.visibility.showAddress && emp.address?.trim()) {
      const addrWrapped = wrapTextMm(emp.address.trim(), 6.0, 'regular', maxWidthMm, 3, fonts);
      const startAddrY = 83.5 - (addrWrapped.lines.length - 1) * 2.6;
      addrWrapped.lines.forEach((line, idx) => {
        frontTexts.push({
          xMm: centerX,
          baselineYMm: startAddrY + idx * 2.6,
          text: line,
          fontSizePt: 6.0,
          weight: 'regular',
          colorKey: 'textMuted',
          align: 'center',
          maxWidthMm,
          overflowed: addrWrapped.overflowed,
        });
      });
    }
  } else {
    // QR at bottom for single-sided 50x90 (no caption underneath)
    const qrSizeMm = 21;
    const qrX = (trimWidthMm - qrSizeMm) / 2;
    const qrY = 63.0;
    frontQrs.push({
      xMm: qrX,
      yMm: qrY,
      sizeMm: qrSizeMm,
      quietZoneMm: 1.4,
      payload: qrPayload,
      withBorder: true,
    });
  }

  pages.push({
    side: 'front',
    trimWidthMm,
    trimHeightMm,
    safeMarginMm,
    background: 'paperWhite',
    rects: frontRects,
    logos: frontLogos,
    qrs: frontQrs,
    texts: frontTexts,
  });

  // ==================== BACK SIDE (50x90, DOUBLE-SIDED) ====================
  if (isDouble) {
    const isDarkBack = config.template === 'contrast-back';
    const backRects: LayoutRect[] = [];
    const backLogos: LayoutLogo[] = [];
    const backQrs: LayoutQr[] = [];
    const backTexts: LayoutText[] = [];

    backRects.push({
      xMm: 0,
      yMm: trimHeightMm - 2.0,
      wMm: trimWidthMm,
      hMm: 2.0,
      colorKey: 'brandGreen',
      extendsToBleed: { bottom: true, left: true, right: true },
    });

    const backLogoW = 35;
    const backLogoH = getLogoHeightMm(backLogoW, 'full');
    backLogos.push({
      xMm: (trimWidthMm - backLogoW) / 2,
      yMm: 11.5,
      wMm: backLogoW,
      hMm: backLogoH,
      variant: 'full',
      inverted: isDarkBack,
    });

    const qrSizeMm = 26;
    const qrX = (trimWidthMm - qrSizeMm) / 2;
    const qrY = 30.5;
    backQrs.push({
      xMm: qrX,
      yMm: qrY,
      sizeMm: qrSizeMm,
      quietZoneMm: 1.8,
      payload: qrPayload,
      withBorder: !isDarkBack,
    });

    backTexts.push({
      xMm: centerX,
      baselineYMm: 74.5,
      text: settings.companyWebsite.replace(/^https?:\/\//i, ''),
      fontSizePt: 8.0,
      weight: 'bold',
      colorKey: isDarkBack ? 'paperWhite' : 'textDark',
      align: 'center',
      maxWidthMm,
    });

    backTexts.push({
      xMm: centerX,
      baselineYMm: 79.0,
      text: settings.companyPhone,
      fontSizePt: 7.2,
      weight: 'medium',
      colorKey: isDarkBack ? 'brandGreen' : 'textMuted',
      align: 'center',
      maxWidthMm,
    });

    pages.push({
      side: 'back',
      trimWidthMm,
      trimHeightMm,
      safeMarginMm,
      background: isDarkBack ? 'brandDarkSolid' : 'paperWhite',
      rects: backRects,
      logos: backLogos,
      qrs: backQrs,
      texts: backTexts,
    });
  }

  return pages;
}
