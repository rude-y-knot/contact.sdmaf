import QRCode from 'qrcode';
import type { CompanySettings, Employee, QrPayloadMode } from '../../types';

export interface QrMatrix {
  size: number;
  modules: boolean[][];
  payload: string;
}

export function buildCardPublicUrl(employeeId: string): string {
  const origin =
    typeof window !== 'undefined' &&
    window.location.hostname === 'contact.sdmaf.ru'
      ? 'https://contact.sdmaf.ru'
      : 'https://contact.sdmaf.ru';
  return `${origin}/?card=${encodeURIComponent(employeeId)}`;
}

export function buildQrPayload(
  employee: Employee,
  settings: CompanySettings,
  mode: QrPayloadMode
): string {
  if (mode === 'card-url') {
    return buildCardPublicUrl(employee.id);
  }

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${employee.lastName};${employee.firstName};;;`,
    `FN:${employee.firstName} ${employee.lastName}`.trim(),
    `ORG:${settings.companyName}`,
    `TITLE:${employee.title}`,
  ];

  const primaryPhone = employee.phone?.trim() || settings.companyPhone;
  if (primaryPhone) {
    lines.push(`TEL;TYPE=CELL:${primaryPhone}`);
  }
  if (employee.phone?.trim() && settings.companyPhone && employee.phone.trim() !== settings.companyPhone) {
    lines.push(`TEL;TYPE=WORK:${settings.companyPhone}`);
  }
  if (employee.email?.trim()) {
    lines.push(`EMAIL:${employee.email.trim()}`);
  }
  const site = employee.website?.trim() || settings.companyWebsite;
  if (site) {
    const url = site.startsWith('http') ? site : `https://${site}`;
    lines.push(`URL:${url}`);
  }
  lines.push('END:VCARD');
  return lines.join('\n');
}

export function createQrMatrix(payload: string): QrMatrix {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const modules: boolean[][] = [];

  for (let row = 0; row < size; row++) {
    const rowArr: boolean[] = [];
    for (let col = 0; col < size; col++) {
      rowArr.push(Boolean(qr.modules.get(row, col)));
    }
    modules.push(rowArr);
  }

  return { size, modules, payload };
}
