import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RotateCcw,
  Search,
  Sliders,
} from 'lucide-react';
import type {
  CardOrientation,
  CardSides,
  CardTemplateId,
  CompanySettings,
  Employee,
  PdfCardConfig,
  QrPayloadMode,
} from '../../types';
import { buildCardPages } from '../../utils/pdf/cardLayouts';
import { CMYK_PALETTE, formatCmykLabel } from '../../utils/pdf/cmykPalette';
import { loadPrintFonts, type LoadedPrintFonts } from '../../utils/pdf/fontLoader';
import { generateCardPdf, triggerPdfDownload } from '../../utils/pdf/generateCardPdf';
import { runPreflightCheck } from '../../utils/pdf/preflightCheck';
import CardPreviewCanvas from './CardPreviewCanvas';

interface PdfCardBuilderProps {
  employees: Employee[];
  settings: CompanySettings;
  initialEmployeeId?: string | null;
  onNotify: (msg: string) => void;
}

const DEFAULT_VISIBILITY = {
  showDepartment: false,
  showPersonalPhone: true,
  showCompanyPhone: false,
  showEmail: true,
  showWebsite: true,
  showAddress: true,
  showTelegram: true,
  showQrHint: false,
};

const DEFAULT_PREPRESS = {
  bleedMm: 2 as const,
  cropMarks: false,
  convertTextToOutlines: true,
  showGuidesInPreview: true,
};

export default function PdfCardBuilder({
  employees,
  settings,
  initialEmployeeId,
  onNotify,
}: PdfCardBuilderProps) {
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.isActive !== false),
    [employees]
  );

  const [empSearch, setEmpSearch] = useState('');
  const [fonts, setFonts] = useState<LoadedPrintFonts | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [previewMode, setPreviewMode] = useState<'front' | 'back' | 'both'>('both');

  const firstId = initialEmployeeId || activeEmployees[0]?.id || employees[0]?.id || '';

  const [config, setConfig] = useState<PdfCardConfig>({
    employeeId: firstId,
    overrides: {},
    orientation: 'horizontal',
    sides: 'single',
    template: 'classic-light',
    qrMode: 'card-url',
    visibility: DEFAULT_VISIBILITY,
    prepress: DEFAULT_PREPRESS,
  });

  useEffect(() => {
    if (initialEmployeeId && employees.some((e) => e.id === initialEmployeeId)) {
      setConfig((prev) => ({
        ...prev,
        employeeId: initialEmployeeId,
        overrides: {},
      }));
    }
  }, [initialEmployeeId, employees]);

  useEffect(() => {
    if (!config.employeeId && activeEmployees.length > 0) {
      setConfig((prev) => ({ ...prev, employeeId: activeEmployees[0].id }));
    }
  }, [activeEmployees, config.employeeId]);

  // Preload print TTF fonts for exact opentype.js line-wrapping in preview and PDF
  useEffect(() => {
    let active = true;
    loadPrintFonts()
      .then((loaded) => {
        if (active) setFonts(loaded);
      })
      .catch((err) => {
        console.error('Font preload error:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedEmployee = useMemo(() => {
    return (
      employees.find((e) => e.id === config.employeeId) ||
      activeEmployees[0] ||
      employees[0] ||
      null
    );
  }, [employees, activeEmployees, config.employeeId]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    const list = activeEmployees.length > 0 ? activeEmployees : employees;
    if (!q) return list;
    return list.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [activeEmployees, employees, empSearch]);

  const builtPages = useMemo(() => {
    if (!selectedEmployee) return [];
    return buildCardPages(selectedEmployee, settings, config, fonts);
  }, [selectedEmployee, settings, config, fonts]);

  const preflightIssues = useMemo(() => {
    if (!selectedEmployee) return [];
    return runPreflightCheck(selectedEmployee, settings, config, builtPages);
  }, [selectedEmployee, settings, config, builtPages]);

  const handleSelectEmployee = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      employeeId: id,
      overrides: {},
    }));
  };

  const handleExportPdf = async () => {
    if (!selectedEmployee) return;
    setIsExporting(true);
    try {
      const result = await generateCardPdf(selectedEmployee, settings, config);
      triggerPdfDownload(result);
      onNotify(
        `PDF CMYK готов: ${result.fileName} (${result.pageCount} стр., ${result.mediaSizeMm.width}×${result.mediaSizeMm.height} мм)`
      );
    } catch (err) {
      console.error('PDF generation failed:', err);
      onNotify('Не удалось сформировать PDF. Проверьте загрузку шрифтов и повторите попытку.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedEmployee) {
    return (
      <div className="bg-white rounded-2xl border border-[#42444A]/12 p-12 text-center">
        <p className="text-base font-semibold text-[#42444A]">В базе данных нет сотрудников</p>
        <p className="text-xs text-[#42444A]/65 mt-1">
          Добавьте хотя бы одну визитку во вкладке «База данных», чтобы сгенерировать PDF.
        </p>
      </div>
    );
  }

  const effectiveOverrides = config.overrides;
  const hasOverrides = Object.keys(effectiveOverrides).length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Controls (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-[#42444A]/12 divide-y divide-[#42444A]/10">
        {/* Step 1: Select employee from SQLite DB */}
        <section className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#42444A]">1. Визитка из базы данных</h2>
            <span className="text-xs text-[#42444A]/55 tabular-nums">
              {activeEmployees.length} активн.
            </span>
          </div>

          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#42444A]/45"
            />
            <input
              type="text"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="Найти сотрудника..."
              className="w-full bg-[#E9E9E9]/50 border border-[#42444A]/12 rounded-xl pl-8 pr-3 py-2 text-xs text-[#42444A] placeholder-[#42444A]/45 focus:outline-none focus:bg-white focus:border-[#70B84F]"
            />
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = emp.id === selectedEmployee.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => handleSelectEmployee(emp.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#42444A] text-white'
                      : 'hover:bg-[#E9E9E9]/70 text-[#42444A]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {emp.firstName} {emp.lastName}
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-white/75' : 'text-[#42444A]/60'
                      }`}
                    >
                      {emp.title} · {emp.department}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[11px] font-semibold text-[#70B84F] shrink-0">
                      Выбрана
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Format & Layout */}
        <section className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-[#42444A]">2. Формат и макет</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium text-[#42444A]/75 mb-1.5">Ориентация</div>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#E9E9E9]/70 rounded-xl">
                {(
                  [
                    { id: 'horizontal', label: '90×50' },
                    { id: 'vertical', label: '50×90' },
                  ] as Array<{ id: CardOrientation; label: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConfig({ ...config, orientation: item.id })}
                    className={`py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                      config.orientation === item.id
                        ? 'bg-white text-[#42444A] shadow-2xs'
                        : 'text-[#42444A]/70 hover:text-[#42444A]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-[#42444A]/75 mb-1.5">Стороны</div>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#E9E9E9]/70 rounded-xl">
                {(
                  [
                    { id: 'single', label: '1 стр.' },
                    { id: 'double', label: '2 стр.' },
                  ] as Array<{ id: CardSides; label: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConfig({ ...config, sides: item.id })}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      config.sides === item.id
                        ? 'bg-white text-[#42444A] shadow-2xs'
                        : 'text-[#42444A]/70 hover:text-[#42444A]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-[#42444A]/75 mb-1.5">Шаблон оформления</div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#E9E9E9]/70 rounded-xl">
              {(
                [
                  { id: 'classic-light', label: 'Светлый' },
                  { id: 'contrast-back', label: 'Тёмный оборот' },
                  { id: 'minimal-grid', label: 'Минимализм' },
                ] as Array<{ id: CardTemplateId; label: string }>
              ).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      template: tpl.id,
                      sides: tpl.id === 'contrast-back' ? 'double' : prev.sides,
                    }))
                  }
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                    config.template === tpl.id
                      ? 'bg-white text-[#42444A] shadow-2xs'
                      : 'text-[#42444A]/70 hover:text-[#42444A]'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Step 3: QR & Fields */}
        <section className="p-5 space-y-3.5">
          <h2 className="text-sm font-bold text-[#42444A]">3. QR-код и отображаемые поля</h2>

          <div className="grid grid-cols-2 gap-1 p-1 bg-[#E9E9E9]/70 rounded-xl">
            {(
              [
                { id: 'card-url', label: 'Ссылка contact.sdmaf.ru' },
                { id: 'vcard', label: 'Прямой vCard' },
              ] as Array<{ id: QrPayloadMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setConfig({ ...config, qrMode: mode.id })}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors truncate cursor-pointer ${
                  config.qrMode === mode.id
                    ? 'bg-white text-[#42444A] shadow-2xs'
                    : 'text-[#42444A]/70 hover:text-[#42444A]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-[#42444A]">
            {(
              [
                ['showPersonalPhone', 'Личный телефон'],
                ['showCompanyPhone', 'Общий телефон офиса'],
                ['showEmail', 'E-mail'],
                ['showWebsite', 'Сайт компании'],
                ['showTelegram', 'Telegram'],
                ['showAddress', 'Адрес'],
                ['showDepartment', 'Департамент'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.visibility[key]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      visibility: { ...config.visibility, [key]: e.target.checked },
                    })
                  }
                  className="accent-[#70B84F]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {/* Local print-only text overrides */}
          <details className="pt-2 border-t border-[#42444A]/10 group">
            <summary className="text-xs font-semibold text-[#42444A]/80 hover:text-[#70B84F] cursor-pointer select-none list-none flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders size={13} />
                <span>Правки текста только для этого PDF</span>
              </span>
              {hasOverrides && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setConfig({ ...config, overrides: {} });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-[#70B84F] hover:underline cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Сбросить</span>
                </button>
              )}
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <input
                type="text"
                value={effectiveOverrides.firstName ?? selectedEmployee.firstName}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overrides: { ...effectiveOverrides, firstName: e.target.value },
                  })
                }
                placeholder="Имя"
                className="bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-lg px-2.5 py-1.5 text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
              />
              <input
                type="text"
                value={effectiveOverrides.lastName ?? selectedEmployee.lastName}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overrides: { ...effectiveOverrides, lastName: e.target.value },
                  })
                }
                placeholder="Фамилия"
                className="bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-lg px-2.5 py-1.5 text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
              />
              <input
                type="text"
                value={effectiveOverrides.title ?? selectedEmployee.title}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overrides: { ...effectiveOverrides, title: e.target.value },
                  })
                }
                placeholder="Должность"
                className="sm:col-span-2 bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-lg px-2.5 py-1.5 text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
              />
              <input
                type="text"
                value={effectiveOverrides.phone ?? selectedEmployee.phone}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overrides: { ...effectiveOverrides, phone: e.target.value },
                  })
                }
                placeholder="Телефон"
                className="bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-lg px-2.5 py-1.5 font-mono text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
              />
              <input
                type="text"
                value={effectiveOverrides.email ?? selectedEmployee.email}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overrides: { ...effectiveOverrides, email: e.target.value },
                  })
                }
                placeholder="E-mail"
                className="bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-lg px-2.5 py-1.5 font-mono text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
              />
              <input
                type="text"
                value={effectiveOverrides.address ?? selectedEmployee.address}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overrides: { ...effectiveOverrides, address: e.target.value },
                  })
                }
                placeholder="Адрес"
                className="sm:col-span-2 bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-lg px-2.5 py-1.5 text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
              />
            </div>
          </details>
        </section>

        {/* Step 4: Prepress */}
        <section className="p-5 space-y-3.5">
          <h2 className="text-sm font-bold text-[#42444A]">4. Параметры типографии (Prepress)</h2>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#42444A]/80">Вылеты под обрез (Bleed)</span>
            <div className="flex items-center gap-1 p-1 bg-[#E9E9E9]/70 rounded-xl">
              {([0, 2, 3] as const).map((mm) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      prepress: { ...config.prepress, bleedMm: mm },
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                    config.prepress.bleedMm === mm
                      ? 'bg-white text-[#42444A] shadow-2xs'
                      : 'text-[#42444A]/70 hover:text-[#42444A]'
                  }`}
                >
                  {mm} мм
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-xs text-[#42444A]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.prepress.convertTextToOutlines}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    prepress: { ...config.prepress, convertTextToOutlines: e.target.checked },
                  })
                }
                className="accent-[#70B84F]"
              />
              <span>Перевести все шрифты в кривые (Outlines — 0 шрифтов в PDF)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.prepress.cropMarks}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    prepress: { ...config.prepress, cropMarks: e.target.checked },
                  })
                }
                className="accent-[#70B84F]"
              />
              <span>Добавить метки реза (Crop Marks)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.prepress.showGuidesInPreview}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    prepress: { ...config.prepress, showGuidesInPreview: e.target.checked },
                  })
                }
                className="accent-[#70B84F]"
              />
              <span>Показывать линии реза и безопасную зону в предпросмотре</span>
            </label>
          </div>

          {/* CMYK Palette reference */}
          <div className="pt-3 border-t border-[#42444A]/10 space-y-1.5">
            <div className="text-[11px] font-semibold text-[#42444A]/65">
              Цветовая модель DeviceCMYK
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono tabular-nums text-[#42444A]/80">
              {[
                CMYK_PALETTE.brandGreen,
                CMYK_PALETTE.brandDarkSolid,
                CMYK_PALETTE.textDark,
                CMYK_PALETTE.qrBlack,
              ].map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-[3px] border border-[#42444A]/20 shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="truncate">{formatCmykLabel(c)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: Live Preview + Preflight + Export (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-[#42444A]/12 p-5 sm:p-6 space-y-5 lg:sticky lg:top-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#42444A]/10">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#42444A] tracking-tight">
              Предпросмотр макета PDF CMYK
            </h1>
            <div className="text-xs text-[#42444A]/65 mt-0.5 tabular-nums">
              {selectedEmployee.firstName} {selectedEmployee.lastName}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {config.orientation === 'horizontal' ? '90×50 мм' : '50×90 мм'}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {config.sides === 'double' ? '2 стороны' : '1 сторона'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {config.sides === 'double' && (
              <div className="flex items-center gap-1 p-1 bg-[#E9E9E9]/70 rounded-xl">
                {(
                  [
                    { id: 'both', label: 'Обе' },
                    { id: 'front', label: 'Лицо' },
                    { id: 'back', label: 'Оборот' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPreviewMode(mode.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      previewMode === mode.id
                        ? 'bg-white text-[#42444A] shadow-2xs'
                        : 'text-[#42444A]/70 hover:text-[#42444A]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#42444A] hover:bg-[#70B84F] disabled:bg-[#42444A]/40 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download size={15} />
              <span>{isExporting ? 'Сборка PDF...' : 'Скачать PDF (CMYK)'}</span>
            </button>
          </div>
        </div>

        {/* SVG Previews */}
        <div
          className={`grid gap-5 ${
            config.sides === 'double' &&
            previewMode === 'both' &&
            config.orientation === 'vertical'
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1'
          }`}
        >
          {builtPages
            .filter((p) => {
              if (config.sides === 'single' || previewMode === 'both') return true;
              return p.side === previewMode;
            })
            .map((page) => (
              <div key={page.side} className="w-full">
                <CardPreviewCanvas
                  page={page}
                  prepress={config.prepress}
                  label={page.side === 'front' ? 'Лицевая сторона (стр. 1)' : 'Оборотная сторона (стр. 2)'}
                />
              </div>
            ))}
        </div>

        {/* Guide Legend */}
        {config.prepress.showGuidesInPreview && (
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#42444A]/70 pt-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-red-600" />
              <span>Линия реза (TrimBox)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-blue-600" />
              <span>Безопасная зона (−4 мм)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[2px] bg-[#E9E9E9] border border-[#42444A]/25" />
              <span>Вылеты под обрез (+{config.prepress.bleedMm} мм)</span>
            </span>
          </div>
        )}

        {/* Preflight Check Summary */}
        <div className="pt-4 border-t border-[#42444A]/10 space-y-2">
          {preflightIssues.map((issue) => (
            <div
              key={issue.id}
              className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs border ${
                issue.severity === 'ok'
                  ? 'bg-[#70B84F]/10 border-[#70B84F]/30 text-[#42444A]'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {issue.severity === 'ok' ? (
                <CheckCircle2 size={15} className="text-[#70B84F] shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
