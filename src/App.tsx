import React, { useState, useEffect } from 'react';
import { Employee } from './types';
import { INITIAL_SHEET_DATA, DEPARTMENTS, COMPANY_NAME, COMPANY_PHONE, COMPANY_WEBSITE, COMPANY_ADDRESS } from './data';
import Header from './components/Header';
import CardView from './components/CardView';
import SheetEditor from './components/SheetEditor';
import PasswordScreen from './components/PasswordScreen';
import Logo from './components/Logo';
import { 
  Search, RefreshCw, Copy, Download, Eye, Users, Phone, Mail, Globe,
  Palette, Megaphone, Wrench, Award, TrendingUp, Coins, Briefcase, Compass, PhoneCall, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const getDepartmentIcon = (dept: string) => {
  const d = dept ? dept.trim().toLowerCase() : '';
  if (d.includes('дизайн')) return <Palette size={20} className="text-[#70B84F]" />;
  if (d.includes('маркетинг')) return <Megaphone size={20} className="text-[#70B84F]" />;
  if (d.includes('производство') || d.includes('металл') || d.includes('цех')) return <Wrench size={20} className="text-[#70B84F]" />;
  if (d.includes('проектирование') || d.includes('конструктор') || d.includes('инженер')) return <Compass size={20} className="text-[#70B84F]" />;
  if (d.includes('управление') || d.includes('руководство') || d.includes('директор')) return <Award size={20} className="text-[#70B84F]" />;
  if (d.includes('продажи')) return <TrendingUp size={20} className="text-[#70B84F]" />;
  if (d.includes('кадры') || d.includes('персонал')) return <Users size={20} className="text-[#70B84F]" />;
  if (d.includes('финансы') || d.includes('бухгалтерия')) return <Coins size={20} className="text-[#70B84F]" />;
  return <Briefcase size={20} className="text-[#70B84F]" />;
};

// --- GOOGLE SHEETS & CSV HELPER FUNCTIONS ---

function parseCsvText(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';
  
  // Detect separator: comma, semicolon or tab
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
          i++; // Skip second quote
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
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentValue.trim());
        if (row.some(val => val !== '')) {
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
  }

  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(val => val !== '')) {
      lines.push(row);
    }
  }

  return lines;
}

function mapCsvToEmployees(rows: string[][]): Employee[] {
  if (rows.length === 0) return [];
  
  let indices = {
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
  const firstRowLower = rows[0].map(h => h.toLowerCase().trim());
  const hasHeaders = firstRowLower.some(h => 
    h.includes('имя') || 
    h.includes('телефон') || 
    h.includes('почта') || 
    h.includes('email') || 
    h.includes('должность')
  );

  if (hasHeaders) {
    firstRowLower.forEach((header, index) => {
      if (header.includes('имя')) indices.firstName = index;
      else if (header.includes('фамилия')) indices.lastName = index;
      else if (header.includes('телефон') || header.includes('тел')) indices.phone = index;
      else if (header.includes('почта') || header.includes('email') || header.includes('mail')) indices.email = index;
      else if (header.includes('должность') || header.includes('роль')) indices.title = index;
      else if (header.includes('департамент') || header.includes('отдел')) indices.department = index;
      else if (header.includes('сайт')) indices.website = index;
      else if (header.includes('адрес')) indices.address = index;
      else if (header.includes('telegram') || header.includes('телеграм')) indices.telegram = index;
      else if (header.includes('whatsapp') || header.includes('ватсап')) indices.whatsapp = index;
      else if (header.includes('макс') || header.includes('max')) indices.maxMessenger = index;
    });
    startIndex = 1;
  }

  const parsedEmployees: Employee[] = [];
  const seenIds = new Set<string>();
  for (let i = startIndex; i < rows.length; i++) {
    const fields = rows[i];
    if (fields.length < 2 || !fields.some(f => f !== '')) continue;

    const getValue = (idx: number, fallback: string = ''): string => {
      if (idx !== -1 && idx < fields.length) {
        return fields[idx].trim();
      }
      return fallback;
    };

    const firstName = getValue(indices.firstName);
    const lastName = getValue(indices.lastName);
    const title = getValue(indices.title);
    
    if (!firstName && !lastName) continue;

    const rawDept = getValue(indices.department);
    let dept = 'Продажи';
    if (rawDept) {
      const rawLower = rawDept.toLowerCase();
      if (rawLower.includes('дизайн')) dept = 'Дизайн';
      else if (rawLower.includes('производ') || rawLower.includes('цех') || rawLower.includes('металл')) dept = 'Производство';
      else if (rawLower.includes('проект') || rawLower.includes('инженер') || rawLower.includes('конструкт')) dept = 'Проектирование';
      else if (rawLower.includes('маркет')) dept = 'Маркетинг';
      else if (rawLower.includes('управ') || rawLower.includes('руковод')) dept = 'Управление';
      else if (rawLower.includes('продаж')) dept = 'Продажи';
      else if (rawLower.includes('кадр')) dept = 'Кадры';
      else if (rawLower.includes('финанс') || rawLower.includes('бухгал')) dept = 'Финансы';
      else dept = rawDept;
    } else {
      const titleLower = title.toLowerCase();
      if (titleLower.includes('дизайн') || titleLower.includes('дизайнер')) dept = 'Дизайн';
      else if (titleLower.includes('производ') || titleLower.includes('цех') || titleLower.includes('металл')) dept = 'Производство';
      else if (titleLower.includes('проект') || titleLower.includes('конструктор') || titleLower.includes('инженер')) dept = 'Проектирование';
      else if (titleLower.includes('продаж') || titleLower.includes('менеджер')) dept = 'Продажи';
    }

    const phoneVal = getValue(indices.phone) || COMPANY_PHONE;
    const whatsappVal = indices.whatsapp !== -1 ? getValue(indices.whatsapp) : phoneVal.replace(/[^0-9]/g, '');

    const rawMaxMessenger = indices.maxMessenger !== -1 ? getValue(indices.maxMessenger).toLowerCase() : '';
    const hasMaxMessenger = indices.maxMessenger !== -1
      ? (rawMaxMessenger !== '' && rawMaxMessenger !== '0' && rawMaxMessenger !== 'нет' && rawMaxMessenger !== 'no' && rawMaxMessenger !== 'false' && rawMaxMessenger !== '-')
      : true;

    // Transliterate for slug-based ID
    const transliterate = (text: string): string => {
      const rus = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
      const eng = ["a","b","v","g","d","e","yo","zh","z","i","y","k","l","m","n","o","p","r","s","t","u","f","kh","ts","ch","sh","shch","","y","","e","yu","ya"];
      return text.toLowerCase().split('').map(char => {
        const idx = rus.indexOf(char);
        return idx !== -1 ? eng[idx] : char;
      }).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    };

    const baseSlug = transliterate(`${firstName}-${lastName}`) || `emp-${i}`;
    let slugId = baseSlug;
    let suffix = 1;
    while (seenIds.has(slugId)) {
      slugId = `${baseSlug}-${suffix}`;
      suffix++;
    }
    seenIds.add(slugId);

    const rawTg = getValue(indices.telegram);
    const cleanTg = rawTg ? rawTg.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').replace(/\/$/, '') : '';

    parsedEmployees.push({
      id: slugId,
      firstName,
      lastName,
      phone: phoneVal,
      email: getValue(indices.email),
      title: title || 'Сотрудник',
      website: getValue(indices.website, COMPANY_WEBSITE),
      address: getValue(indices.address, COMPANY_ADDRESS),
      department: dept,
      telegram: cleanTg,
      whatsapp: whatsappVal || undefined,
      maxMessenger: hasMaxMessenger
    });
  }

  return parsedEmployees;
}

async function fetchGoogleSheetData(urlStr: string): Promise<Employee[]> {
  if (!urlStr.trim()) {
    throw new Error('Ссылка на таблицу пуста');
  }

  let csvUrl = urlStr.trim();
  
  const match = csvUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const sheetId = match[1];
    if (csvUrl.includes('/pubhtml')) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`;
    } else if (!csvUrl.includes('pub?output=csv') && !csvUrl.includes('export?format=csv')) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`;
    }
  }

  const response = await fetch(csvUrl);
  if (!response.ok) {
    if (match && match[1]) {
      const altResponse = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`);
      if (altResponse.ok) {
        const csvText = await altResponse.text();
        const parsed = parseCsvText(csvText);
        const mapped = mapCsvToEmployees(parsed);
        return mapped;
      }
    }
    throw new Error(`Не удалось загрузить данные (HTTP ${response.status})`);
  }

  const csvText = await response.text();
  const parsed = parseCsvText(csvText);
  const mapped = mapCsvToEmployees(parsed);
  return mapped;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('catalog');
  
  // Persistent localStorage initialization with updated base table
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const cached = localStorage.getItem('stalnoe_employees_v4');
    return cached ? JSON.parse(cached) : INITIAL_SHEET_DATA;
  });

  const [sheetRows, setSheetRows] = useState<Employee[]>(() => {
    const cached = localStorage.getItem('stalnoe_sheet_rows_v4');
    return cached ? JSON.parse(cached) : INITIAL_SHEET_DATA;
  });

  const DEFAULT_GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSZtMIlBpnLHjK5t8gk78LCEkkmW056i93xMB6CfqG9AsI47Yngm2KDw5mzYGNYXnzOYSBAwK4me0g/pub?output=csv';
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(() => {
    return localStorage.getItem('stalnoe_sheet_url') || DEFAULT_GOOGLE_SHEET_URL;
  });

  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Standalone card detection for shared link viewing
  const [standaloneEmployee, setStandaloneEmployee] = useState<Employee | null>(null);

  // Authentication state for editing page and employee list
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('stalnoe_auth') === 'true';
  });

  useEffect(() => {
    const checkCard = () => {
      const params = new URLSearchParams(window.location.search);
      const cardId = params.get('card') || params.get('id');
      if (cardId) {
        const emp = employees.find(e => e.id === cardId);
        if (emp) {
          setStandaloneEmployee(emp);
          return;
        }
      }
      setStandaloneEmployee(null);
    };

    checkCard();
    window.addEventListener('popstate', checkCard);
    return () => window.removeEventListener('popstate', checkCard);
  }, [employees]);
  
  const [selectedDept, setSelectedDept] = useState<string>('Все');
  
  // Sync status states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Persist sheet rows and employees
  useEffect(() => {
    localStorage.setItem('stalnoe_sheet_rows_v4', JSON.stringify(sheetRows));
  }, [sheetRows]);

  useEffect(() => {
    localStorage.setItem('stalnoe_employees_v4', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('stalnoe_sheet_url', googleSheetUrl);
  }, [googleSheetUrl]);

  // Google Sheet fetch handler
  const handleFetchFromGoogleSheet = async (urlStr: string = googleSheetUrl) => {
    setIsSyncingSheet(true);
    try {
      const data = await fetchGoogleSheetData(urlStr);
      if (data.length > 0) {
        setSheetRows(data);
        setEmployees(data);
        setGoogleSheetUrl(urlStr);
        const now = new Date();
        setLastSyncTime(now.toLocaleTimeString());
        showToast(`✅ Данные синхронизированы! Контактов: ${data.length}`);
      } else {
        showToast('⚠️ В таблице не обнаружены данные о сотрудниках.');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      showToast(`❌ Ошибка загрузки Google Таблицы.`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Manual Trigger for sync
  const triggerManualSync = async () => {
    setIsSyncing(true);
    try {
      const data = await fetchGoogleSheetData(googleSheetUrl);
      if (data.length > 0) {
        setSheetRows(data);
        setEmployees(data);
        const now = new Date();
        setLastSyncTime(now.toLocaleTimeString());
        showToast(`✅ Google Таблица синхронизирована! Контактов: ${data.length}`);
      } else {
        showToast('⚠️ В таблице не обнаружены данные о сотрудниках.');
      }
    } catch (err) {
      console.error('Sync failed:', err);
      showToast('❌ Ошибка синхронизации с Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Clipboard copy helper
  const copyCardLink = (employee: Employee) => {
    const cardUrl = `${window.location.origin}${window.location.pathname}?card=${employee.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cardUrl)
        .then(() => {
          showToast(`🔗 Ссылка скопирована: ${cardUrl}`);
        })
        .catch(() => {
          fallbackCopy(cardUrl);
        });
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
    showToast(`🔗 Ссылка скопирована: ${text}`);
  };

  // vCard file builder & download in Windows-1251
  const downloadVCF = (employee: Employee) => {
    try {
      const stringToCP1251Bytes = (str: string): Uint8Array => {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          if (code < 128) {
            bytes[i] = code;
          } else if (code >= 1040 && code <= 1103) { // Cyrillic
            bytes[i] = code - 1040 + 192;
          } else if (code === 1025) { // 'Ё'
            bytes[i] = 168;
          } else if (code === 1105) { // 'ё'
            bytes[i] = 184;
          } else {
            bytes[i] = 63;
          }
        }
        return bytes;
      };

      const fullName = `${employee.firstName} ${employee.lastName}`.trim();

      const vcardText = [
        'BEGIN:VCARD',
        'VERSION:2.1',
        `FN;CHARSET=WINDOWS-1251:${fullName}`,
        `N;CHARSET=WINDOWS-1251:${employee.lastName};${employee.firstName};;;`,
        `ORG;CHARSET=WINDOWS-1251:${COMPANY_NAME}`,
        `TITLE;CHARSET=WINDOWS-1251:${employee.title}`,
        `TEL;CELL:${employee.phone}`,
        `TEL;WORK:${COMPANY_PHONE}`,
        `EMAIL;PREF;INTERNET:${employee.email}`,
        employee.website ? `URL;WORK:https://${employee.website.replace('https://', '').replace('http://', '')}` : '',
        employee.address ? `ADR;WORK;CHARSET=WINDOWS-1251:;;${employee.address};;;;` : '',
        employee.telegram ? `X-SOCIALPROFILE;type=telegram:https://t.me/${employee.telegram}` : '',
        employee.whatsapp ? `X-SOCIALPROFILE;type=whatsapp:https://wa.me/${employee.whatsapp}` : '',
        `REV:${new Date().toISOString()}`,
        'END:VCARD'
      ].filter(Boolean).join('\r\n');

      const bytes = stringToCP1251Bytes(vcardText);
      const blob = new Blob([bytes], { type: 'text/vcard;charset=windows-1251;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${employee.lastName}_${employee.firstName}_contact.vcf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('📥 Файл контакта сохранен в смартфон!');
    } catch (err) {
      showToast('❌ Ошибка при генерации файла контакта');
    }
  };

  // CSV text importer
  const handleImportCsv = (csvText: string) => {
    if (!csvText.trim()) return;

    try {
      const parsed = parseCsvText(csvText);
      const mapped = mapCsvToEmployees(parsed);

      if (mapped.length > 0) {
        setSheetRows([...sheetRows, ...mapped]);
        setEmployees([...employees, ...mapped]);
        showToast(`📊 Успешно импортировано контактов: ${mapped.length}!`);
      } else {
        showToast('⚠️ Ошибка распознавания: проверьте соответствие колонок.');
      }
    } catch (error) {
      showToast('❌ Не удалось выполнить импорт CSV.');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
                          emp.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'Все' || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  if (standaloneEmployee) {
    return (
      <div className="min-h-screen bg-[#E9E9E9] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden antialiased text-[#42444A]">
        {/* Soft background ambient accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#70B84F]/10 rounded-full blur-[140px] pointer-events-none"></div>
        
        {/* Top return link */}
        <div className="w-full max-w-md mb-4 flex justify-between items-center">
          <button
            onClick={() => {
              window.history.pushState(null, '', window.location.pathname);
              setStandaloneEmployee(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#42444A] hover:text-[#70B84F] bg-white/80 hover:bg-white px-3 py-1.5 rounded-lg border border-[#42444A]/10 shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Все визитки компании</span>
          </button>
          <div className="text-[10px] text-[#42444A]/60 font-mono font-semibold uppercase tracking-wider">
            {COMPANY_NAME}
          </div>
        </div>
        
        <CardView 
          employee={standaloneEmployee} 
          onDownloadVCF={downloadVCF}
          onCopyLink={copyCardLink}
          standalone={true}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PasswordScreen onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#E9E9E9] text-[#42444A] font-sans flex flex-col antialiased">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-5 left-1/2 z-50 bg-[#42444A] text-white px-5 py-3 rounded-full shadow-2xl flex items-center space-x-2.5 font-semibold text-xs sm:text-sm border-2 border-[#70B84F] transition-all"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brand Navigation Header */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogoClick={() => setActiveTab('catalog')}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8">

        {/* ==================== VIEW 1: CATALOGUE VIEW ==================== */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header Title & Sync Banner */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#42444A]/10 shadow-xs">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#42444A] tracking-tight flex items-center gap-2.5">
                    <Users className="text-[#70B84F]" size={28} />
                    <span>Визитные карточки «{COMPANY_NAME}»</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-[#42444A]/70 mt-1">
                    Электронные контактные карточки сотрудников с сохранением в vCard и Apple/Google Wallet.
                  </p>
                </div>

                {/* Sync status widget */}
                <div className="bg-[#E9E9E9]/60 p-3 rounded-xl border border-[#42444A]/10 text-xs flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#70B84F] animate-pulse"></span>
                    <span className="text-[#42444A]/80 font-medium">Синхронизация каждый час</span>
                  </div>
                  <span className="text-[#42444A]/30 hidden sm:inline">|</span>
                  <span className="text-[#42444A]/70">
                    Обновлено: <strong className="text-[#42444A] font-mono">{lastSyncTime}</strong>
                  </span>
                  <button 
                    onClick={triggerManualSync}
                    disabled={isSyncing}
                    className="text-[#42444A] hover:text-[#70B84F] font-bold transition-colors cursor-pointer flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-[#42444A]/10 shadow-2xs"
                  >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin text-[#70B84F]' : 'text-[#70B84F]'} />
                    <span>Обновить</span>
                  </button>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="bg-white p-4.5 rounded-2xl border border-[#42444A]/10 flex flex-col md:flex-row gap-4 justify-between items-center shadow-xs">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[#42444A]/40" size={16} />
                  <input
                    type="text"
                    placeholder="Поиск по имени, фамилии или должности..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#E9E9E9]/50 border border-[#42444A]/15 rounded-xl text-[#42444A] placeholder-[#42444A]/40 focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F] transition-all font-medium text-xs sm:text-sm"
                  />
                </div>

                {/* Category Buttons */}
                <div className="flex flex-wrap gap-1.5 w-full md:w-auto justify-start md:justify-end">
                  {DEPARTMENTS.map(dept => (
                    <button
                      key={dept}
                      onClick={() => setSelectedDept(dept)}
                      className={`px-3.5 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${
                        selectedDept === dept 
                          ? 'bg-[#42444A] text-white shadow-xs' 
                          : 'bg-[#E9E9E9]/60 text-[#42444A] border border-[#42444A]/10 hover:text-[#70B84F] hover:bg-white'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee Bento Grid */}
              {filteredEmployees.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  {filteredEmployees.map((emp) => (
                    <div 
                      key={emp.id}
                      className="bg-white rounded-2xl border border-[#42444A]/10 hover:border-[#70B84F] transition-all duration-200 overflow-hidden flex flex-col group justify-between shadow-xs hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-xl bg-[#E9E9E9] flex items-center justify-center text-[#70B84F] border border-[#42444A]/10 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                            {getDepartmentIcon(emp.department)}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-[#70B84F]/15 text-[#42444A] rounded-lg border border-[#70B84F]/30">
                            {emp.department}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-[#42444A] mt-4 group-hover:text-[#70B84F] transition-colors leading-snug">
                          {emp.firstName} {emp.lastName}
                        </h3>
                        <p className="text-[#42444A]/70 text-xs font-semibold mt-1">{emp.title}</p>

                        <div className="mt-4 space-y-2 text-xs text-[#42444A]/80 border-t border-[#42444A]/10 pt-3.5">
                          <div className="flex items-center space-x-2">
                            <Phone size={13} className="text-[#70B84F] shrink-0" />
                            <span className="font-mono">{emp.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Mail size={13} className="text-[#70B84F] shrink-0" />
                            <span className="font-mono text-[11px] truncate">{emp.email}</span>
                          </div>
                          {emp.website && (
                            <div className="flex items-center space-x-2">
                              <Globe size={13} className="text-[#70B84F] shrink-0" />
                              <span className="font-mono text-[11px] truncate">{emp.website}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Interactive Card Action Buttons: #42444A default, #70B84F on hover */}
                      <div className="p-3 bg-[#E9E9E9]/40 border-t border-[#42444A]/10 flex space-x-2">
                        <button
                          onClick={() => {
                            window.history.pushState(null, '', `?card=${emp.id}`);
                            setStandaloneEmployee(emp);
                          }}
                          className="flex-1 bg-[#42444A] hover:bg-[#70B84F] text-white text-xs font-bold py-2 px-3 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Eye size={13} />
                          <span>Открыть визитку</span>
                        </button>
                        
                        <button
                          onClick={() => copyCardLink(emp)}
                          title="Скопировать ссылку на визитку"
                          className="p-2 bg-white hover:bg-[#70B84F] text-[#42444A] hover:text-white rounded-xl border border-[#42444A]/15 transition-all text-xs cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <Copy size={13} />
                        </button>
                        
                        <button
                          onClick={() => downloadVCF(emp)}
                          title="Скачать контакт VCF"
                          className="p-2 bg-white hover:bg-[#70B84F] text-[#42444A] hover:text-white rounded-xl border border-[#42444A]/15 transition-all text-xs cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#42444A]/10 shadow-xs">
                  <p className="text-[#42444A] text-base font-semibold">Сотрудники по выбранным критериям не найдены</p>
                  <p className="text-[#42444A]/60 text-xs mt-1">Попробуйте изменить поисковый запрос или сбросить фильтры.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* ==================== VIEW 2: SHEETS EDITOR ==================== */}
        {activeTab === 'sheet-editor' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SheetEditor 
              sheetRows={sheetRows}
              setSheetRows={setSheetRows}
              isSyncing={isSyncing}
              onManualSync={triggerManualSync}
              onImportCsv={handleImportCsv}
              googleSheetUrl={googleSheetUrl}
              setGoogleSheetUrl={setGoogleSheetUrl}
              onFetchFromGoogleSheet={handleFetchFromGoogleSheet}
              isSyncingSheet={isSyncingSheet}
            />
          </motion.div>
        )}

      </main>

      {/* Styled Footer */}
      <footer className="border-t border-[#42444A]/10 bg-white/70 py-6 text-center text-xs text-[#42444A]/70 font-sans mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <Logo className="h-5 w-auto" />
            <p>© {new Date().getFullYear()} {COMPANY_NAME} • Тел: <a href={`tel:${COMPANY_PHONE.replace(/\s+/g, '')}`} className="font-bold font-mono text-[#42444A] hover:text-[#70B84F]">{COMPANY_PHONE}</a></p>
          </div>
          <p className="text-[11px] text-[#42444A]/60 font-mono">
            Автосинхронизация: Google Sheets API • Формат визиток: vCard v2.1 (Windows-1251)
          </p>
        </div>
      </footer>

    </div>
  );
}
