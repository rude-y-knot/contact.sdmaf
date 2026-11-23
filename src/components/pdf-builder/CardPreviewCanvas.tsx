import React, { useMemo } from 'react';
import type { PrepressOptions } from '../../types';
import { PT_TO_MM, type BuiltCardPage } from '../../utils/pdf/cardLayouts';
import { CMYK_PALETTE } from '../../utils/pdf/cmykPalette';
import {
  LOGO_FULL_PATHS,
  LOGO_FULL_VIEWBOX,
  LOGO_MARK_PATHS,
  LOGO_MARK_VIEWBOX,
} from '../../utils/pdf/logoGeometry';
import { createQrMatrix } from '../../utils/pdf/qrVector';

interface CardPreviewCanvasProps {
  page: BuiltCardPage;
  prepress: PrepressOptions;
  label: string;
}

const FONT_WEIGHT_MAP = {
  regular: 400,
  medium: 500,
  bold: 700,
} as const;

export default function CardPreviewCanvas({
  page,
  prepress,
  label,
}: CardPreviewCanvasProps) {
  const bleedMm = prepress.bleedMm;
  const cropMarginMm = prepress.cropMarks ? 5 : 0;
  const offsetMm = bleedMm + cropMarginMm;

  const mediaW = page.trimWidthMm + offsetMm * 2;
  const mediaH = page.trimHeightMm + offsetMm * 2;
  const bleedW = page.trimWidthMm + bleedMm * 2;
  const bleedH = page.trimHeightMm + bleedMm * 2;

  const qrMatrices = useMemo(() => {
    return page.qrs.map((qr) => ({
      qr,
      matrix: createQrMatrix(qr.payload),
    }));
  }, [page.qrs]);

  const isHorizontal = page.trimWidthMm > page.trimHeightMm;
  const markLen = 3.5;
  const markGap = bleedMm + 0.8;

  return (
    <div className="flex flex-col items-center gap-2.5 w-full">
      <div className="w-full flex items-center justify-between text-xs text-[#42444A]/70">
        <span className="font-semibold text-[#42444A]">{label}</span>
        <span className="font-mono tabular-nums text-[11px]">
          {page.trimWidthMm}×{page.trimHeightMm} мм
          {bleedMm > 0 ? ` · вылеты ${bleedW}×${bleedH} мм` : ''}
        </span>
      </div>

      <div
        className={`w-full flex items-center justify-center p-4 sm:p-6 bg-[#E9E9E9]/70 rounded-xl border border-[#42444A]/10 ${
          isHorizontal ? '' : 'py-5'
        }`}
      >
        <svg
          viewBox={`0 0 ${mediaW} ${mediaH}`}
          className={`block drop-shadow-md rounded-[2px] bg-white ${
            isHorizontal ? 'w-full max-w-[520px] h-auto' : 'h-[400px] sm:h-[440px] w-auto max-w-full'
          }`}
          role="img"
          aria-label={`Предпросмотр визитки: ${label}`}
        >
          {/* Paper sheet outside BleedBox when crop marks are active */}
          {cropMarginMm > 0 && (
            <rect x={0} y={0} width={mediaW} height={mediaH} fill="#F8F8F8" />
          )}

          {/* BleedBox clip + Background */}
          <rect
            x={cropMarginMm}
            y={cropMarginMm}
            width={bleedW}
            height={bleedH}
            fill={CMYK_PALETTE[page.background].hex}
          />

          {/* Vector rectangles */}
          {page.rects.map((rect, i) => {
            const extL = rect.extendsToBleed?.left ? bleedMm : 0;
            const extR = rect.extendsToBleed?.right ? bleedMm : 0;
            const extT = rect.extendsToBleed?.top ? bleedMm : 0;
            const extB = rect.extendsToBleed?.bottom ? bleedMm : 0;
            return (
              <rect
                key={`r-${i}`}
                x={offsetMm + rect.xMm - extL}
                y={offsetMm + rect.yMm - extT}
                width={rect.wMm + extL + extR}
                height={rect.hMm + extT + extB}
                fill={CMYK_PALETTE[rect.colorKey].hex}
              />
            );
          })}

          {/* Vector logos */}
          {page.logos.map((logo, i) => {
            const paths = logo.variant === 'full' ? LOGO_FULL_PATHS : LOGO_MARK_PATHS;
            const vb = logo.variant === 'full' ? LOGO_FULL_VIEWBOX : LOGO_MARK_VIEWBOX;
            const scale = logo.wMm / vb.width;
            const darkHex = logo.inverted
              ? CMYK_PALETTE.paperWhite.hex
              : CMYK_PALETTE.brandDarkSolid.hex;
            const greenHex = CMYK_PALETTE.brandGreen.hex;

            return (
              <g
                key={`logo-${i}`}
                transform={`translate(${offsetMm + logo.xMm}, ${offsetMm + logo.yMm}) scale(${scale})`}
              >
                {paths.map((seg, idx) => (
                  <path
                    key={idx}
                    d={seg.d}
                    fill={seg.role === 'green' ? greenHex : darkHex}
                  />
                ))}
              </g>
            );
          })}

          {/* Vector QR codes */}
          {qrMatrices.map(({ qr, matrix }, i) => {
            const innerSize = Math.max(4, qr.sizeMm - 2 * qr.quietZoneMm);
            const cell = innerSize / matrix.size;
            const startX = offsetMm + qr.xMm + qr.quietZoneMm;
            const startY = offsetMm + qr.yMm + qr.quietZoneMm;

            return (
              <g key={`qr-${i}`}>
                <rect
                  x={offsetMm + qr.xMm}
                  y={offsetMm + qr.yMm}
                  width={qr.sizeMm}
                  height={qr.sizeMm}
                  fill={CMYK_PALETTE.paperWhite.hex}
                  stroke={qr.withBorder ? CMYK_PALETTE.dividerGray.hex : 'none'}
                  strokeWidth={qr.withBorder ? 0.14 : 0}
                />
                {matrix.modules.map((row, r) =>
                  row.map((isDark, c) =>
                    isDark ? (
                      <rect
                        key={`${r}-${c}`}
                        x={startX + c * cell}
                        y={startY + r * cell}
                        width={cell + 0.02}
                        height={cell + 0.02}
                        fill={CMYK_PALETTE.qrBlack.hex}
                      />
                    ) : null
                  )
                )}
              </g>
            );
          })}

          {/* Typography */}
          {page.texts.map((txt, i) => {
            const anchor =
              txt.align === 'center' ? 'middle' : txt.align === 'right' ? 'end' : 'start';
            return (
              <text
                key={`t-${i}`}
                x={offsetMm + txt.xMm}
                y={offsetMm + txt.baselineYMm}
                fontSize={txt.fontSizePt * PT_TO_MM}
                fontFamily='"IBM Plex Sans", sans-serif'
                fontWeight={FONT_WEIGHT_MAP[txt.weight]}
                fill={CMYK_PALETTE[txt.colorKey].hex}
                textAnchor={anchor}
              >
                {txt.text}
              </text>
            );
          })}

          {/* Crop marks */}
          {prepress.cropMarks && (
            <g stroke="#000000" strokeWidth={0.12}>
              {/* Top-left */}
              <line x1={offsetMm - markGap - markLen} y1={offsetMm} x2={offsetMm - markGap} y2={offsetMm} />
              <line x1={offsetMm} y1={offsetMm - markGap - markLen} x2={offsetMm} y2={offsetMm - markGap} />
              {/* Top-right */}
              <line x1={offsetMm + page.trimWidthMm + markGap} y1={offsetMm} x2={offsetMm + page.trimWidthMm + markGap + markLen} y2={offsetMm} />
              <line x1={offsetMm + page.trimWidthMm} y1={offsetMm - markGap - markLen} x2={offsetMm + page.trimWidthMm} y2={offsetMm - markGap} />
              {/* Bottom-left */}
              <line x1={offsetMm - markGap - markLen} y1={offsetMm + page.trimHeightMm} x2={offsetMm - markGap} y2={offsetMm + page.trimHeightMm} />
              <line x1={offsetMm} y1={offsetMm + page.trimHeightMm + markGap} x2={offsetMm} y2={offsetMm + page.trimHeightMm + markGap + markLen} />
              {/* Bottom-right */}
              <line x1={offsetMm + page.trimWidthMm + markGap} y1={offsetMm + page.trimHeightMm} x2={offsetMm + page.trimWidthMm + markGap + markLen} y2={offsetMm + page.trimHeightMm} />
              <line x1={offsetMm + page.trimWidthMm} y1={offsetMm + page.trimHeightMm + markGap} x2={offsetMm + page.trimWidthMm} y2={offsetMm + page.trimHeightMm + markGap + markLen} />
            </g>
          )}

          {/* Prepress Guide Overlays */}
          {prepress.showGuidesInPreview && (
            <g pointerEvents="none">
              {/* TrimBox line (red dashed) */}
              <rect
                x={offsetMm}
                y={offsetMm}
                width={page.trimWidthMm}
                height={page.trimHeightMm}
                fill="none"
                stroke="#DC2626"
                strokeWidth={0.22}
                strokeDasharray="1.2 0.8"
              />
              {/* Safe zone line (blue dashed) */}
              <rect
                x={offsetMm + page.safeMarginMm}
                y={offsetMm + page.safeMarginMm}
                width={page.trimWidthMm - page.safeMarginMm * 2}
                height={page.trimHeightMm - page.safeMarginMm * 2}
                fill="none"
                stroke="#2563EB"
                strokeWidth={0.18}
                strokeDasharray="0.9 0.9"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
