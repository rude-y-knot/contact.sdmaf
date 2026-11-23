import type { CompanySettings, Employee, PdfCardConfig } from '../../types';
import type { BuiltCardPage } from './cardLayouts';
import { resolveEffectiveEmployee } from './cardLayouts';

export interface PreflightIssue {
  id: string;
  severity: 'ok' | 'warning';
  message: string;
}

export function runPreflightCheck(
  employee: Employee,
  settings: CompanySettings,
  config: PdfCardConfig,
  pages: BuiltCardPage[]
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const effective = resolveEffectiveEmployee(employee, config.overrides, settings);

  if (!effective.firstName.trim() || !effective.lastName.trim()) {
    issues.push({
      id: 'missing-name',
      severity: 'warning',
      message: 'Не заполнено имя или фамилия сотрудника.',
    });
  }

  if (!effective.phone?.trim() && config.visibility.showPersonalPhone) {
    issues.push({
      id: 'fallback-phone',
      severity: 'warning',
      message: `У сотрудника нет личного телефона — на визитку подставлен общий номер ${settings.companyPhone}.`,
    });
  }

  if (config.prepress.bleedMm === 0) {
    issues.push({
      id: 'no-bleed',
      severity: 'warning',
      message: 'Вылеты под обрез отключены (0 мм). Большинство типографий требуют минимум 2 мм.',
    });
  }

  if (config.qrMode === 'vcard') {
    issues.push({
      id: 'vcard-density',
      severity: 'warning',
      message: 'Прямой vCard делает сетку QR плотнее. Для лучшего сканирования и обновления контактов без перепечатки рекомендуется ссылка contact.sdmaf.ru.',
    });
  }

  const hasOverflow = pages.some((page) => page.texts.some((t) => t.overflowed));
  if (hasOverflow) {
    issues.push({
      id: 'text-overflow',
      severity: 'warning',
      message: 'Часть текста вплотную подходит к границе безопасной зоны. При желании сократите текст в блоке «Правки для печати».',
    });
  }

  const smallQr = pages.some((page) => page.qrs.some((q) => q.sizeMm < 15));
  if (smallQr) {
    issues.push({
      id: 'small-qr',
      severity: 'warning',
      message: 'Размер QR-кода меньше рекомендуемых 15×15 мм.',
    });
  }

  if (issues.length === 0) {
    const trimLabel = config.orientation === 'horizontal' ? '90×50 мм' : '50×90 мм';
    const bleedW = (config.orientation === 'horizontal' ? 90 : 50) + config.prepress.bleedMm * 2;
    const bleedH = (config.orientation === 'horizontal' ? 50 : 90) + config.prepress.bleedMm * 2;
    issues.push({
      id: 'all-clear',
      severity: 'ok',
      message: `Готово к типографии: DeviceCMYK, вектор, обрезной ${trimLabel} (с вылетами ${bleedW}×${bleedH} мм), QR 100% Black.`,
    });
  }

  return issues;
}
