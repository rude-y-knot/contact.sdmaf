import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  Coins,
  Compass,
  Copy,
  Download,
  Eye,
  Globe,
  Mail,
  Megaphone,
  Palette,
  Phone,
  Printer,
  Search,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import CardView from './components/CardView';
import DatabaseAdmin from './components/DatabaseAdmin';
import Header, { type AdminTab } from './components/Header';
import Logo from './components/Logo';
import PasswordScreen from './components/PasswordScreen';
import PdfCardBuilder from './components/pdf-builder/PdfCardBuilder';
import {
  COMPANY_ADDRESS,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_WEBSITE,
  DEPARTMENTS,
} from './data';
import { api, ApiError } from './services/api';
import type { CompanySettings, Employee } from './types';

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: COMPANY_NAME,
  companyPhone: COMPANY_PHONE,
  companyWebsite: COMPANY_WEBSITE,
  companyAddress: COMPANY_ADDRESS,
};

const getDepartmentIcon = (dept: string) => {
  const d = dept ? dept.trim().toLowerCase() : '';
  if (d.includes('дизайн')) return <Palette size={18} className="text-[#70B84F]" />;
  if (d.includes('маркетинг')) return <Megaphone size={18} className="text-[#70B84F]" />;
  if (d.includes('производство') || d.includes('металл') || d.includes('цех'))
    return <Wrench size={18} className="text-[#70B84F]" />;
  if (d.includes('проектирование') || d.includes('конструктор') || d.includes('инженер'))
    return <Compass size={18} className="text-[#70B84F]" />;
  if (d.includes('управление') || d.includes('руководство') || d.includes('директор'))
    return <Award size={18} className="text-[#70B84F]" />;
  if (d.includes('продажи')) return <TrendingUp size={18} className="text-[#70B84F]" />;
  if (d.includes('кадры') || d.includes('персонал'))
    return <Users size={18} className="text-[#70B84F]" />;
  if (d.includes('финансы') || d.includes('бухгалтерия'))
    return <Coins size={18} className="text-[#70B84F]" />;
  return <Briefcase size={18} className="text-[#70B84F]" />;
};

function parseCsvText(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  const firstLine = text.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let separator = ',';
  if (semiCount > commaCount && semiCount > tabCount) {
    separator = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    separator = '\t';
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === separator) {
        row.push(currentValue.trim());
        currentValue = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(currentValue.trim());
        if (row.some((val) => val !== '')) lines.push(row);
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
  }

  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some((val) => val !== '')) lines.push(row);
  }

  return lines;
}

function mapCsvToEmployees(
  rows: string[][],
  settings: CompanySettings
): Array<Omit<Employee, 'id'> & { id?: string }> {
  if (rows.length === 0) return [];

  const indices = {
    id: -1,
    firstName: 0,
    lastName: 1,
    phone: 2,
    email: 3,
    title: 4,
    department: 5,
    website: 6,
    address: 7,
    telegram: -1,
    whatsapp: -1,
    maxMessenger: -1,
  };

  let startIndex = 0;
  const firstRowLower = rows[0].map((h) => h.toLowerCase().trim());
  const hasHeaders = firstRowLower.some(
    (h) =>
      h.includes('имя') ||
      h.includes('телефон') ||
      h.includes('почта') ||
      h.includes('email') ||
      h.includes('должность')
  );

  if (hasHeaders) {
    firstRowLower.forEach((header, index) => {
      if (header === 'id' || header === 'слаг') indices.id = index;
      else if (header.includes('имя')) indices.firstName = index;
      else if (header.includes('фамилия')) indices.lastName = index;
      else if (header.includes('телефон') || header.includes('тел')) indices.phone = index;
      else if (header.includes('почта') || header.includes('email') || header.includes('mail'))
        indices.email = index;
      else if (header.includes('должность') || header.includes('роль')) indices.title = index;
      else if (header.includes('департамент') || header.includes('отдел'))
        indices.department = index;
      else if (header.includes('сайт')) indices.website = index;
      else if (header.includes('адрес')) indices.address = index;
      else if (header.includes('telegram') || header.includes('телеграм'))
        indices.telegram = index;
      else if (header.includes('whatsapp') || header.includes('ватсап'))
        indices.whatsapp = index;
      else if (header.includes('макс') || header.includes('max')) indices.maxMessenger = index;
    });
    startIndex = 1;
  }

  const result: Array<Omit<Employee, 'id'> & { id?: string }> = [];
  for (let i = startIndex; i < rows.length; i++) {
    const fields = rows[i];
    if (fields.length < 2 || !fields.some((f) => f !== '')) continue;

    const getVal = (idx: number, fallback = '') =>
      idx !== -1 && idx < fields.length ? fields[idx].trim() : fallback;

    const firstName = getVal(indices.firstName);
    const lastName = getVal(indices.lastName);
    if (!firstName && !lastName) continue;

    const phoneVal = getVal(indices.phone);
    const rawMax = indices.maxMessenger !== -1 ? getVal(indices.maxMessenger).toLowerCase() : '';
    const hasMax =
      indices.maxMessenger !== -1
        ? rawMax !== '' &&
          rawMax !== '0' &&
          rawMax !== 'нет' &&
          rawMax !== 'no' &&
          rawMax !== 'false' &&
          rawMax !== '-'
        : false;

    const rawTg = getVal(indices.telegram);
    const cleanTg = rawTg
      ? rawTg
          .replace(/^https?:\/\/t\.me\//i, '')
          .replace(/^@/, '')
          .replace(/\/$/, '')
      : '';

    result.push({
      id: getVal(indices.id) || undefined,
      firstName,
      lastName,
      title: getVal(indices.title) || 'Сотрудник',
      department: getVal(indices.department) || 'Продажи',
      phone: phoneVal,
      email: getVal(indices.email),
      website: getVal(indices.website, settings.companyWebsite),
      address: getVal(indices.address, settings.companyAddress),
      telegram: cleanTg,
      whatsapp:
        indices.whatsapp !== -1
          ? getVal(indices.whatsapp)
          : phoneVal.replace(/[^0-9]/g, ''),
      maxMessenger: hasMax,
      isActive: true,
    });
  }

  return result;
}

function getCardIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('card') || params.get('id');
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');
  const [pdfEmployeeId, setPdfEmployeeId] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Public standalone card state (?card=...)
  const [urlCardId, setUrlCardId] = useState<string | null>(() => getCardIdFromUrl());
  const [standaloneEmployee, setStandaloneEmployee] = useState<Employee | null>(null);
  const [loadingStandalone, setLoadingStandalone] = useState<boolean>(() =>
    Boolean(getCardIdFromUrl())
  );
  const [standaloneNotFound, setStandaloneNotFound] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('Все');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // Listen to browser navigation (back/forward)
  useEffect(() => {
    const onPopState = () => {
      setUrlCardId(getCardIdFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Load standalone card publicly from SQLite API when ?card=... is present
  useEffect(() => {
    if (!urlCardId) {
      setStandaloneEmployee(null);
      setStandaloneNotFound(false);
      setLoadingStandalone(false);
      return;
    }

    let active = true;
    setLoadingStandalone(true);
    setStandaloneNotFound(false);

    api
      .getPublicCard(urlCardId)
      .then((res) => {
        if (!active) return;
        setStandaloneEmployee(res.employee);
        setSettings(res.settings);
      })
      .catch(() => {
        if (!active) return;
        setStandaloneEmployee(null);
        setStandaloneNotFound(true);
      })
      .finally(() => {
        if (active) setLoadingStandalone(false);
      });

    return () => {
      active = false;
    };
  }, [urlCardId]);

  const loadAdminDatabase = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const data = await api.getEmployees();
      setEmployees(data.employees);
      setSettings(data.settings);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setIsAuthenticated(false);
      } else {
        showToast('Не удалось загрузить базу визиток с сервера.');
      }
    } finally {
      setIsLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated && !urlCardId) {
      loadAdminDatabase();
    }
  }, [isAuthenticated, urlCardId, loadAdminDatabase]);

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setEmployees([]);
  };

  const openStandaloneCard = (emp: Employee) => {
    window.history.pushState(null, '', `?card=${encodeURIComponent(emp.id)}`);
    setUrlCardId(emp.id);
    setStandaloneEmployee(emp);
    setStandaloneNotFound(false);
    setLoadingStandalone(false);
  };

  const openPdfForEmployee = (emp: Employee) => {
    setPdfEmployeeId(emp.id);
    setActiveTab('pdf-builder');
  };

  const copyCardLink = (employee: Employee) => {
    const cardUrl = `${window.location.origin}${window.location.pathname}?card=${employee.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(cardUrl)
        .then(() => showToast(`Ссылка скопирована: ${cardUrl}`))
        .catch(() => fallbackCopy(cardUrl));
    } else {
      fallbackCopy(cardUrl);
    }
  };

  const fallbackCopy = (text: string) => {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(`Ссылка скопирована: ${text}`);
  };

  // vCard 2.1 Windows-1251 download for maximum iOS/Android Cyrillic compatibility
  const downloadVCF = (employee: Employee) => {
    try {
      const stringToCP1251Bytes = (str: string): Uint8Array => {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          if (code < 128) bytes[i] = code;
          else if (code >= 1040 && code <= 1103) bytes[i] = code - 1040 + 192;
          else if (code === 1025) bytes[i] = 168;
          else if (code === 1105) bytes[i] = 184;
          else bytes[i] = 63;
        }
        return bytes;
      };

      const fullName = `${employee.firstName} ${employee.lastName}`.trim();
      const vcardText = [
        'BEGIN:VCARD',
        'VERSION:2.1',
        `FN;CHARSET=WINDOWS-1251:${fullName}`,
        `N;CHARSET=WINDOWS-1251:${employee.lastName};${employee.firstName};;;`,
        `ORG;CHARSET=WINDOWS-1251:${settings.companyName}`,
        `TITLE;CHARSET=WINDOWS-1251:${employee.title}`,
        employee.phone ? `TEL;CELL:${employee.phone}` : '',
        `TEL;WORK:${settings.companyPhone}`,
        employee.email ? `EMAIL;PREF;INTERNET:${employee.email}` : '',
        employee.website
          ? `URL;WORK:https://${employee.website.replace(/^https?:\/\//i, '')}`
          : '',
        employee.address ? `ADR;WORK;CHARSET=WINDOWS-1251:;;${employee.address};;;;` : '',
        employee.telegram
          ? `X-SOCIALPROFILE;type=telegram:https://t.me/${employee.telegram}`
          : '',
        employee.whatsapp
          ? `X-SOCIALPROFILE;type=whatsapp:https://wa.me/${employee.whatsapp}`
          : '',
        `REV:${new Date().toISOString()}`,
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\r\n');

      const bytes = stringToCP1251Bytes(vcardText);
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: 'text/vcard;charset=windows-1251;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${employee.lastName}_${employee.firstName}_contact.vcf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast('Файл контакта сохранён.');
    } catch {
      showToast('Ошибка при генерации файла контакта.');
    }
  };

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.isActive !== false),
    [employees]
  );

  const availableDepartments = useMemo(() => {
    const dynamic = activeEmployees.map((e) => e.department).filter(Boolean);
    return Array.from(new Set([...DEPARTMENTS, ...dynamic]));
  }, [activeEmployees]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeEmployees.filter((emp) => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        emp.title.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q);
      const matchesDept = selectedDept === 'Все' || emp.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [activeEmployees, searchQuery, selectedDept]);

  // ==================== PUBLIC STANDALONE CARD VIEW ====================
  if (urlCardId) {
    if (loadingStandalone) {
      return (
        <div className="min-h-screen bg-[#E9E9E9] flex items-center justify-center p-6">
          <div className="w-7 h-7 border-2 border-[#42444A]/20 border-t-[#70B84F] rounded-full animate-spin" />
        </div>
      );
    }

    if (standaloneNotFound || !standaloneEmployee) {
      return (
        <div className="min-h-screen bg-[#E9E9E9] flex items-center justify-center p-6 text-[#42444A]">
          <div className="bg-white rounded-2xl border border-[#42444A]/12 p-8 max-w-sm w-full text-center space-y-3">
            <div className="flex justify-center">
              <Logo className="h-8 w-auto" />
            </div>
            <h1 className="text-lg font-bold">Визитка не найдена</h1>
            <p className="text-xs text-[#42444A]/70 leading-relaxed">
              Ссылка устарела или карточка сотрудника перенесена в архив.
            </p>
            <a
              href={`https://${settings.companyWebsite.replace(/^https?:\/\//i, '')}`}
              className="inline-block mt-2 px-4 py-2 rounded-xl bg-[#42444A] hover:bg-[#70B84F] text-white text-xs font-semibold transition-colors"
            >
              Перейти на {settings.companyWebsite}
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#E9E9E9] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden antialiased text-[#42444A]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#70B84F]/10 rounded-full blur-[140px] pointer-events-none" />
        <CardView
          employee={standaloneEmployee}
          onDownloadVCF={downloadVCF}
          onCopyLink={copyCardLink}
          standalone={true}
        />
      </div>
    );
  }

  // ==================== ADMIN AUTH GATE ====================
  if (!isAuthenticated) {
    return <PasswordScreen onSuccess={() => setIsAuthenticated(true)} />;
  }

  // ==================== ADMIN WORKSPACE ====================
  return (
    <div className="min-h-screen bg-[#E9E9E9] text-[#42444A] font-sans flex flex-col antialiased">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -32, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -16, x: '-50%' }}
            className="fixed top-5 left-1/2 z-50 bg-[#42444A] text-white px-5 py-3 rounded-xl shadow-xl flex items-center text-xs sm:text-sm font-medium border border-[#70B84F]/60 max-w-[92vw]"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogoClick={() => setActiveTab('catalog')}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ==================== TAB 1: CATALOG ==================== */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#42444A]/12 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#42444A] tracking-tight">
                  Визитные карточки «{settings.companyName}»
                </h1>
                <div className="text-xs text-[#42444A]/65 mt-1 tabular-nums">
                  Активных визиток: {activeEmployees.length}
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  Единая база SQLite
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  Экспорт vCard и PDF CMYK 50×90
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#42444A]/15 text-[#42444A] hover:border-[#70B84F] hover:text-[#70B84F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Управлять базой
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pdf-builder')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#42444A] hover:bg-[#70B84F] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Конструктор PDF</span>
                </button>
              </div>
            </div>

            {/* Search & Department Filter */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#42444A]/45"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени, должности, телефону..."
                  className="w-full bg-white border border-[#42444A]/12 rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#42444A] placeholder-[#42444A]/45 focus:outline-none focus:border-[#70B84F]"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-white/80 rounded-xl border border-[#42444A]/12 overflow-x-auto">
                {availableDepartments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedDept === dept
                        ? 'bg-[#42444A] text-white'
                        : 'text-[#42444A]/75 hover:text-[#42444A] hover:bg-[#E9E9E9]/60'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Employee Cards Grid */}
            {isLoadingData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((k) => (
                  <div
                    key={k}
                    className="h-56 bg-white/70 rounded-2xl border border-[#42444A]/10 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredEmployees.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="bg-white rounded-2xl border border-[#42444A]/12 overflow-hidden flex flex-col justify-between transition-colors hover:border-[#70B84F]/60"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-[#42444A] truncate">
                            {emp.firstName} {emp.lastName}
                          </h2>
                          <p className="text-xs text-[#42444A]/70 mt-0.5">{emp.title}</p>
                          <div className="text-[11px] text-[#42444A]/55 mt-1">
                            {emp.department}
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="font-mono">?card={emp.id}</span>
                          </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-[#E9E9E9]/60 flex items-center justify-center shrink-0">
                          {getDepartmentIcon(emp.department)}
                        </div>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-[#42444A]/10 space-y-1.5 text-xs text-[#42444A]/80">
                        <div className="flex items-center gap-2">
                          <Phone size={13} className="text-[#70B84F] shrink-0" />
                          <span className="font-mono tabular-nums">
                            {emp.phone || `${settings.companyPhone} (офис)`}
                          </span>
                        </div>
                        {emp.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={13} className="text-[#70B84F] shrink-0" />
                            <span className="font-mono text-[11px] truncate">{emp.email}</span>
                          </div>
                        )}
                        {emp.website && (
                          <div className="flex items-center gap-2">
                            <Globe size={13} className="text-[#70B84F] shrink-0" />
                            <span className="font-mono text-[11px] truncate">{emp.website}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-[#E9E9E9]/35 border-t border-[#42444A]/10 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openStandaloneCard(emp)}
                        className="flex-1 bg-[#42444A] hover:bg-[#70B84F] text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Открыть</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPdfForEmployee(emp)}
                        title="Создать печатный PDF CMYK"
                        className="px-2.5 py-2 bg-white hover:bg-[#70B84F] text-[#42444A] hover:text-white rounded-xl border border-[#42444A]/15 transition-colors text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Printer size={13} />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => copyCardLink(emp)}
                        title="Скопировать ссылку на визитку"
                        className="p-2 bg-white hover:bg-[#70B84F] text-[#42444A] hover:text-white rounded-xl border border-[#42444A]/15 transition-colors cursor-pointer"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadVCF(emp)}
                        title="Скачать контакт VCF"
                        className="p-2 bg-white hover:bg-[#70B84F] text-[#42444A] hover:text-white rounded-xl border border-[#42444A]/15 transition-colors cursor-pointer"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-14 bg-white rounded-2xl border border-[#42444A]/12">
                <p className="text-sm font-semibold text-[#42444A]">
                  Сотрудники по выбранным критериям не найдены
                </p>
                <p className="text-xs text-[#42444A]/60 mt-1">
                  Попробуйте изменить запрос или сбросить фильтр отдела.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: SQLITE DATABASE ADMIN ==================== */}
        {activeTab === 'database' && (
          <DatabaseAdmin
            employees={employees}
            settings={settings}
            onRefresh={loadAdminDatabase}
            onOpenCard={openStandaloneCard}
            onOpenPdfBuilder={openPdfForEmployee}
            onNotify={showToast}
            parseCsvEmployees={(raw) => mapCsvToEmployees(parseCsvText(raw), settings)}
          />
        )}

        {/* ==================== TAB 3: CMYK PDF BUILDER ==================== */}
        {activeTab === 'pdf-builder' && (
          <PdfCardBuilder
            employees={employees}
            settings={settings}
            initialEmployeeId={pdfEmployeeId}
            onNotify={showToast}
          />
        )}
      </main>

      <footer className="border-t border-[#42444A]/10 bg-white/75 py-5 text-xs text-[#42444A]/70 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <Logo className="h-5 w-auto" />
            <span>
              © {new Date().getFullYear()} {settings.companyName} ·{' '}
              <a
                href={`tel:${settings.companyPhone.replace(/\s+/g, '')}`}
                className="font-mono font-semibold text-[#42444A] hover:text-[#70B84F]"
              >
                {settings.companyPhone}
              </a>
            </span>
          </div>
          <span className="text-[11px] text-[#42444A]/60">
            База данных SQLite · Экспорт PDF CMYK (50×90 / 90×50 мм) · vCard v2.1
          </span>
        </div>
      </footer>
    </div>
  );
}
