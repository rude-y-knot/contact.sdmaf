export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  title: string;
  website: string;
  address: string;
  department: string;
  telegram?: string;
  whatsapp?: string;
  maxMessenger?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanySettings {
  companyName: string;
  companyPhone: string;
  companyWebsite: string;
  companyAddress: string;
}

export type CardOrientation = 'horizontal' | 'vertical';
export type CardSides = 'single' | 'double';
export type CardTemplateId = 'classic-light' | 'contrast-back' | 'minimal-grid';
export type QrPayloadMode = 'card-url' | 'vcard';

export interface PrepressOptions {
  bleedMm: 0 | 2 | 3;
  cropMarks: boolean;
  convertTextToOutlines: boolean;
  showGuidesInPreview: boolean;
}

export interface CardVisibilityOptions {
  showDepartment: boolean;
  showPersonalPhone: boolean;
  showCompanyPhone: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showAddress: boolean;
  showTelegram: boolean;
  showQrHint: boolean;
}

export interface PdfCardConfig {
  employeeId: string;
  overrides: Partial<Employee>;
  orientation: CardOrientation;
  sides: CardSides;
  template: CardTemplateId;
  qrMode: QrPayloadMode;
  visibility: CardVisibilityOptions;
  prepress: PrepressOptions;
}
