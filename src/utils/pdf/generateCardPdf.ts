import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import type { CompanySettings, Employee, PdfCardConfig } from '../../types';
import { buildCardPages, MM_TO_PT, type BuiltCardPage } from './cardLayouts';
import { CMYK_PALETTE } from './cmykPalette';
import {
  loadPrintFonts,
  measureTextWidthPt,
  textToSvgPathData,
  type FontWeightKey,
  type LoadedPrintFonts,
} from './fontLoader';
import {
  LOGO_FULL_PATHS,
  LOGO_FULL_VIEWBOX,
  LOGO_MARK_PATHS,
  LOGO_MARK_VIEWBOX,
} from './logoGeometry';
import { createQrMatrix } from './qrVector';

export interface GeneratedPdfResult {
  bytes: Uint8Array;
  fileName: string;
  pageCount: number;
  trimSizeMm: { width: number; height: number };
  bleedSizeMm: { width: number; height: number };
  mediaSizeMm: { width: number; height: number };
}

function drawCropMarks(
  page: PDFPage,
  trimW: number,
  trimH: number,
  bleedMm: number,
  cropMarginMm: number
): void {
  const offsetMm = bleedMm + cropMarginMm;
  const mediaH = trimH + 2 * offsetMm;
  const markLenPt = 3.5 * MM_TO_PT;
  const markGapPt = (bleedMm + 0.8) * MM_TO_PT;
  const thicknessPt = 0.25;
  const color = CMYK_PALETTE.cropMarkBlack.pdf;

  const trimLeftPt = offsetMm * MM_TO_PT;
  const trimRightPt = (offsetMm + trimW) * MM_TO_PT;
  const trimTopPt = (mediaH - offsetMm) * MM_TO_PT;
  const trimBottomPt = (mediaH - (offsetMm + trimH)) * MM_TO_PT;

  // Top-left
  page.drawLine({
    start: { x: trimLeftPt - markGapPt - markLenPt, y: trimTopPt },
    end: { x: trimLeftPt - markGapPt, y: trimTopPt },
    thickness: thicknessPt,
    color,
  });
  page.drawLine({
    start: { x: trimLeftPt, y: trimTopPt + markGapPt },
    end: { x: trimLeftPt, y: trimTopPt + markGapPt + markLenPt },
    thickness: thicknessPt,
    color,
  });

  // Top-right
  page.drawLine({
    start: { x: trimRightPt + markGapPt, y: trimTopPt },
    end: { x: trimRightPt + markGapPt + markLenPt, y: trimTopPt },
    thickness: thicknessPt,
    color,
  });
  page.drawLine({
    start: { x: trimRightPt, y: trimTopPt + markGapPt },
    end: { x: trimRightPt, y: trimTopPt + markGapPt + markLenPt },
    thickness: thicknessPt,
    color,
  });

  // Bottom-left
  page.drawLine({
    start: { x: trimLeftPt - markGapPt - markLenPt, y: trimBottomPt },
    end: { x: trimLeftPt - markGapPt, y: trimBottomPt },
    thickness: thicknessPt,
    color,
  });
  page.drawLine({
    start: { x: trimLeftPt, y: trimBottomPt - markGapPt - markLenPt },
    end: { x: trimLeftPt, y: trimBottomPt - markGapPt },
    thickness: thicknessPt,
    color,
  });

  // Bottom-right
  page.drawLine({
    start: { x: trimRightPt + markGapPt, y: trimBottomPt },
    end: { x: trimRightPt + markGapPt + markLenPt, y: trimBottomPt },
    thickness: thicknessPt,
    color,
  });
  page.drawLine({
    start: { x: trimRightPt, y: trimBottomPt - markGapPt - markLenPt },
    end: { x: trimRightPt, y: trimBottomPt - markGapPt },
    thickness: thicknessPt,
    color,
  });
}

function renderCardPageToPdf(
  pdfDoc: PDFDocument,
  layoutPage: BuiltCardPage,
  config: PdfCardConfig,
  loadedFonts: LoadedPrintFonts,
  embeddedFonts: Record<FontWeightKey, PDFFont> | null
): void {
  const bleedMm = config.prepress.bleedMm;
  const cropMarginMm = config.prepress.cropMarks ? 5 : 0;
  const offsetMm = bleedMm + cropMarginMm;

  const mediaWidthMm = layoutPage.trimWidthMm + 2 * offsetMm;
  const mediaHeightMm = layoutPage.trimHeightMm + 2 * offsetMm;

  const mediaWidthPt = mediaWidthMm * MM_TO_PT;
  const mediaHeightPt = mediaHeightMm * MM_TO_PT;
  const cropMarginPt = cropMarginMm * MM_TO_PT;
  const offsetPt = offsetMm * MM_TO_PT;

  const page = pdfDoc.addPage([mediaWidthPt, mediaHeightPt]);
  page.setMediaBox(0, 0, mediaWidthPt, mediaHeightPt);
  page.setBleedBox(
    cropMarginPt,
    cropMarginPt,
    (layoutPage.trimWidthMm + 2 * bleedMm) * MM_TO_PT,
    (layoutPage.trimHeightMm + 2 * bleedMm) * MM_TO_PT
  );
  page.setTrimBox(
    offsetPt,
    offsetPt,
    layoutPage.trimWidthMm * MM_TO_PT,
    layoutPage.trimHeightMm * MM_TO_PT
  );

  const toPdfX = (xMm: number) => (offsetMm + xMm) * MM_TO_PT;
  const toPdfYFromTop = (yMm: number) => (mediaHeightMm - (offsetMm + yMm)) * MM_TO_PT;

  // 1. Background covering full BleedBox (DeviceCMYK)
  page.drawRectangle({
    x: cropMarginPt,
    y: cropMarginPt,
    width: (layoutPage.trimWidthMm + 2 * bleedMm) * MM_TO_PT,
    height: (layoutPage.trimHeightMm + 2 * bleedMm) * MM_TO_PT,
    color: CMYK_PALETTE[layoutPage.background].pdf,
  });

  // 2. Vector rectangles / accent bars
  for (const rect of layoutPage.rects) {
    const extL = rect.extendsToBleed?.left ? bleedMm : 0;
    const extR = rect.extendsToBleed?.right ? bleedMm : 0;
    const extT = rect.extendsToBleed?.top ? bleedMm : 0;
    const extB = rect.extendsToBleed?.bottom ? bleedMm : 0;

    const xMm = rect.xMm - extL;
    const yMm = rect.yMm - extT;
    const wMm = rect.wMm + extL + extR;
    const hMm = rect.hMm + extT + extB;

    page.drawRectangle({
      x: toPdfX(xMm),
      y: toPdfYFromTop(yMm + hMm),
      width: wMm * MM_TO_PT,
      height: hMm * MM_TO_PT,
      color: CMYK_PALETTE[rect.colorKey].pdf,
    });
  }

  // 3. Vector «Стальное дело» logos
  for (const logo of layoutPage.logos) {
    const paths = logo.variant === 'full' ? LOGO_FULL_PATHS : LOGO_MARK_PATHS;
    const vb = logo.variant === 'full' ? LOGO_FULL_VIEWBOX : LOGO_MARK_VIEWBOX;
    const scale = (logo.wMm * MM_TO_PT) / vb.width;
    const pdfX = toPdfX(logo.xMm);
    const pdfY = toPdfYFromTop(logo.yMm);

    const darkColor = logo.inverted
      ? CMYK_PALETTE.paperWhite.pdf
      : CMYK_PALETTE.brandDarkSolid.pdf;
    const greenColor = CMYK_PALETTE.brandGreen.pdf;

    for (const seg of paths) {
      page.drawSvgPath(seg.d, {
        x: pdfX,
        y: pdfY,
        scale,
        color: seg.role === 'green' ? greenColor : darkColor,
      });
    }
  }

  // 4. Vector QR codes (strictly pure K=100% on paperWhite quiet zone)
  for (const qr of layoutPage.qrs) {
    const matrix = createQrMatrix(qr.payload);
    const outerX = toPdfX(qr.xMm);
    const outerYBottom = toPdfYFromTop(qr.yMm + qr.sizeMm);
    const outerSizePt = qr.sizeMm * MM_TO_PT;

    // White quiet zone plate
    page.drawRectangle({
      x: outerX,
      y: outerYBottom,
      width: outerSizePt,
      height: outerSizePt,
      color: CMYK_PALETTE.paperWhite.pdf,
      borderColor: qr.withBorder ? CMYK_PALETTE.dividerGray.pdf : undefined,
      borderWidth: qr.withBorder ? 0.4 : 0,
    });

    const innerSizeMm = Math.max(4, qr.sizeMm - 2 * qr.quietZoneMm);
    const moduleSizePt = (innerSizeMm * MM_TO_PT) / matrix.size;
    const startXPt = toPdfX(qr.xMm + qr.quietZoneMm);
    const startYTopPt = toPdfYFromTop(qr.yMm + qr.quietZoneMm);
    // Tiny overlap prevents hairline anti-aliasing seams in some PDF viewers
    const overlap = 0.04;

    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (matrix.modules[r][c]) {
          page.drawRectangle({
            x: startXPt + c * moduleSizePt,
            y: startYTopPt - (r + 1) * moduleSizePt,
            width: moduleSizePt + overlap,
            height: moduleSizePt + overlap,
            color: CMYK_PALETTE.qrBlack.pdf,
          });
        }
      }
    }
  }

  // 5. Typography (Outlines via opentype.js OR subset-embedded TTF)
  for (const txt of layoutPage.texts) {
    if (!txt.text.trim()) continue;
    const otFont = loadedFonts.opentypeFonts[txt.weight];
    const textWidthPt = measureTextWidthPt(otFont, txt.text, txt.fontSizePt);

    let baselineXPt = toPdfX(txt.xMm);
    if (txt.align === 'center') {
      baselineXPt -= textWidthPt / 2;
    } else if (txt.align === 'right') {
      baselineXPt -= textWidthPt;
    }
    const baselineYPt = toPdfYFromTop(txt.baselineYMm);
    const color = CMYK_PALETTE[txt.colorKey].pdf;

    if (config.prepress.convertTextToOutlines || !embeddedFonts) {
      const pathData = textToSvgPathData(otFont, txt.text, txt.fontSizePt);
      if (pathData) {
        page.drawSvgPath(pathData, {
          x: baselineXPt,
          y: baselineYPt,
          scale: 1,
          color,
        });
      }
    } else {
      page.drawText(txt.text, {
        x: baselineXPt,
        y: baselineYPt,
        size: txt.fontSizePt,
        font: embeddedFonts[txt.weight],
        color,
      });
    }
  }

  // 6. Crop marks outside BleedBox
  if (config.prepress.cropMarks) {
    drawCropMarks(page, layoutPage.trimWidthMm, layoutPage.trimHeightMm, bleedMm, cropMarginMm);
  }
}

export async function generateCardPdf(
  employee: Employee,
  settings: CompanySettings,
  config: PdfCardConfig
): Promise<GeneratedPdfResult> {
  const loadedFonts = await loadPrintFonts();
  const pages = buildCardPages(employee, settings, config, loadedFonts);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Визитка ${employee.firstName} ${employee.lastName} — ${settings.companyName}`);
  pdfDoc.setAuthor(settings.companyName);
  pdfDoc.setSubject('Печатная визитная карточка CMYK');
  pdfDoc.setCreator('contact.sdmaf.ru PDF CMYK Builder');

  let embeddedFonts: Record<FontWeightKey, PDFFont> | null = null;
  if (!config.prepress.convertTextToOutlines) {
    pdfDoc.registerFontkit(fontkit);
    const [regular, medium, bold] = await Promise.all([
      pdfDoc.embedFont(loadedFonts.buffers.regular, { subset: true }),
      pdfDoc.embedFont(loadedFonts.buffers.medium, { subset: true }),
      pdfDoc.embedFont(loadedFonts.buffers.bold, { subset: true }),
    ]);
    embeddedFonts = { regular, medium, bold };
  }

  for (const layoutPage of pages) {
    renderCardPageToPdf(pdfDoc, layoutPage, config, loadedFonts, embeddedFonts);
  }

  const bytes = await pdfDoc.save({ useObjectStreams: false });
  const trimW = config.orientation === 'horizontal' ? 90 : 50;
  const trimH = config.orientation === 'horizontal' ? 50 : 90;
  const bleedMm = config.prepress.bleedMm;
  const cropMarginMm = config.prepress.cropMarks ? 5 : 0;

  const safeId = employee.id.replace(/[^a-z0-9_-]/gi, '_');
  const sizeTag = `${trimW}x${trimH}`;
  const sidesTag = config.sides === 'double' ? '2sides' : '1side';

  return {
    bytes,
    fileName: `SDMAF_${safeId}_${sizeTag}_${sidesTag}_CMYK.pdf`,
    pageCount: pages.length,
    trimSizeMm: { width: trimW, height: trimH },
    bleedSizeMm: { width: trimW + bleedMm * 2, height: trimH + bleedMm * 2 },
    mediaSizeMm: {
      width: trimW + (bleedMm + cropMarginMm) * 2,
      height: trimH + (bleedMm + cropMarginMm) * 2,
    },
  };
}

export function triggerPdfDownload(result: GeneratedPdfResult): void {
  const blob = new Blob([result.bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
