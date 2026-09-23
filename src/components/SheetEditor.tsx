import React, { useState } from 'react';
import { Employee } from '../types';
import { 
  Database, Plus, Trash2, FileSpreadsheet, Upload, RefreshCw, X, Lock, Check
} from 'lucide-react';
import { DEPARTMENTS, COMPANY_NAME, COMPANY_WEBSITE, COMPANY_ADDRESS, COMPANY_PHONE } from '../data';

interface SheetEditorProps {
  sheetRows: Employee[];
  setSheetRows: (rows: Employee[]) => void;
  isSyncing: boolean;
  onManualSync: () => void;
  onImportCsv: (csvText: string) => void;
  googleSheetUrl: string;
  setGoogleSheetUrl: (url: string) => void;
  onFetchFromGoogleSheet: (url: string) => Promise<void>;
  isSyncingSheet: boolean;
}

export default function SheetEditor({ 
  sheetRows, 
  setSheetRows, 
  isSyncing, 
  onManualSync, 
  onImportCsv,
  googleSheetUrl,
  setGoogleSheetUrl,
  onFetchFromGoogleSheet,
  isSyncingSheet
}: SheetEditorProps) {
  const [showCsvImporter, setShowCsvImporter] = useState(false);
  const [rawCsvInput, setRawCsvInput] = useState('');
  
  // New employee row state
  const [newRow, setNewRow] = useState<Omit<Employee, 'id'>>({
    firstName: '',
    lastName: '',
    phone: COMPANY_PHONE,
    email: '',
    title: '',
    website: COMPANY_WEBSITE,
    address: COMPANY_ADDRESS,
    department: 'Продажи',
    telegram: '',
    whatsapp: '',
    maxMessenger: true
  });

  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRow.firstName.trim() || !newRow.lastName.trim() || !newRow.title.trim()) {
      return;
    }
    
    const nextId = (Math.max(...sheetRows.map(r => parseInt(r.id) || 0), 0) + 1).toString();
    const phoneDigits = newRow.phone.replace(/[^0-9]/g, '');

    const added: Employee = {
      ...newRow,
      id: nextId,
      whatsapp: phoneDigits || undefined
    };

    setSheetRows([...sheetRows, added]);
    
    // Reset form fields
    setNewRow({
      firstName: '',
      lastName: '',
      phone: COMPANY_PHONE,
      email: '',
      title: '',
      website: COMPANY_WEBSITE,
      address: COMPANY_ADDRESS,
      department: 'Продажи',
      telegram: '',
      whatsapp: '',
      maxMessenger: true
    });
  };

  const handleDeleteRow = (id: string) => {
    setSheetRows(sheetRows.filter(row => row.id !== id));
  };

  const handleUpdateField = (id: string, field: keyof Employee, value: any) => {
    const updated = sheetRows.map(r => {
      if (r.id === id) {
        const item = { ...r, [field]: value };
        if (field === 'phone') {
          item.whatsapp = value.replace(/[^0-9]/g, '');
        }
        return item;
      }
      return r;
    });
    setSheetRows(updated);
  };

  const submitCsvText = (e: React.FormEvent) => {
    e.preventDefault();
    onImportCsv(rawCsvInput);
    setRawCsvInput('');
    setShowCsvImporter(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#42444A]/10 p-6 sm:p-8 shadow-lg text-[#42444A]">
      
      {/* Panel Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-[#42444A]/10">
        <div>
          <h2 className="text-2xl font-bold text-[#42444A] flex items-center gap-2.5">
            <FileSpreadsheet className="text-[#70B84F]" />
            <span>Панель управления (Google Таблица)</span>
          </h2>
          <p className="text-[#42444A]/70 text-sm mt-1 leading-relaxed">
            Интерактивный пульт управления данными визиток компании «{COMPANY_NAME}».
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setShowCsvImporter(!showCsvImporter)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#E9E9E9]/80 hover:bg-[#E9E9E9] text-[#42444A] hover:text-[#70B84F] font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all border border-[#42444A]/15 cursor-pointer shadow-2xs"
          >
            <Upload size={15} />
            <span>{showCsvImporter ? 'Скрыть импорт' : 'Импортировать CSV'}</span>
          </button>
          
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#42444A] hover:bg-[#70B84F] disabled:bg-[#42444A]/40 text-white font-bold py-2.5 px-5 rounded-xl text-xs sm:text-sm transition-all shadow-md cursor-pointer active:scale-[0.99]"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            <span>Синхронизировать</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Integration Card */}
      <div className="mb-6 p-5 bg-[#E9E9E9]/50 rounded-xl border border-[#42444A]/10 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#70B84F]/15 flex items-center justify-center border border-[#70B84F]/30">
              <FileSpreadsheet className="text-[#70B84F]" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#42444A]">Источник данных (База визиток)</h3>
              <p className="text-xs text-[#42444A]/70 mt-0.5">
                База контактов сотрудников компании «{COMPANY_NAME}» ({sheetRows.length} чел.). Вы можете редактировать данные в таблице ниже или подключить новую Google Таблицу.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-9 relative">
            <input
              type="text"
              value={googleSheetUrl}
              onChange={(e) => setGoogleSheetUrl(e.target.value)}
              placeholder="Вставьте ссылку на новую опубликованную Google Таблицу (CSV) или оставьте пустым"
              className="w-full bg-white border border-[#42444A]/15 rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-[#42444A] placeholder-[#42444A]/40 font-mono focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F] shadow-2xs"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#42444A]/50">
              <FileSpreadsheet size={14} className="text-[#70B84F]" />
            </div>
          </div>
          <div className="lg:col-span-3">
            <button
              onClick={() => onFetchFromGoogleSheet(googleSheetUrl)}
              disabled={isSyncingSheet || !googleSheetUrl.trim()}
              className="w-full bg-[#42444A] hover:bg-[#70B84F] disabled:bg-[#42444A]/30 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
            >
              {isSyncingSheet ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Синхронизация...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  <span>Подключить таблицу</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CSV Paste Importer Box */}
      {showCsvImporter && (
        <div className="mb-6 p-5 bg-[#E9E9E9]/60 rounded-xl border border-[#70B84F]/40 space-y-3 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-[#42444A] flex items-center gap-1.5">
                <Upload size={15} className="text-[#70B84F]" />
                Импорт строк из Google Sheets или CSV буфера
              </h3>
              <p className="text-xs text-[#42444A]/70 mt-1">
                Скопируйте ячейки из таблицы и вставьте их ниже. Разделение колонок произойдет автоматически.
              </p>
            </div>
            <button 
              onClick={() => setShowCsvImporter(false)}
              className="p-1 text-[#42444A]/60 hover:text-[#42444A] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          
          <form onSubmit={submitCsvText} className="space-y-3">
            <textarea
              value={rawCsvInput}
              onChange={(e) => setRawCsvInput(e.target.value)}
              placeholder='Имя,Фамилия,Телефон,почта,Должность,Департамент,Сайт компании,Адрес компании,Мессенджер Макс&#10;Юрий,Станиславский,+79214388883,marketing@kom3.ru,Директор по маркетингу,Маркетинг,www.sdmaf.ru,"Санкт-Петербург, г. Колпино, Финлядская д. 3",Нет'
              rows={4}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl p-3 text-xs font-mono text-[#42444A] focus:outline-none focus:border-[#70B84F] placeholder-[#42444A]/40 focus:ring-1 focus:ring-[#70B84F]"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowCsvImporter(false)}
                className="px-3 py-1.5 text-xs text-[#42444A]/70 hover:text-[#42444A] cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="bg-[#42444A] hover:bg-[#70B84F] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-all shadow-xs"
              >
                Распознать и добавить
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Spreadsheet Table Wrapper */}
      <div className="overflow-x-auto border border-[#42444A]/15 rounded-xl bg-white shadow-xs">
        <table className="min-w-full divide-y divide-[#42444A]/10 text-xs text-left">
          <thead className="bg-[#E9E9E9]/70 text-[#42444A] text-[10px] uppercase tracking-wider font-bold font-mono">
            <tr>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10 w-12 text-center">ID</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Имя</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Фамилия</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Телефон</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">почта</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Должность</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Сайт компании</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Адрес компании</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Telegram</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10 text-center">МАКС</th>
              <th className="px-3.5 py-3 border-r border-[#42444A]/10">Отдел</th>
              <th className="px-3.5 py-3 text-center">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#42444A]/10 text-[#42444A] font-sans">
            {sheetRows.map((row) => (
              <tr key={row.id} className="hover:bg-[#E9E9E9]/40 transition-colors">
                <td className="px-3 py-2 border-r border-[#42444A]/10 font-mono text-center font-bold text-[#42444A] bg-[#E9E9E9]/30">
                  {row.id}
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.firstName} 
                    onChange={(e) => handleUpdateField(row.id, 'firstName', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-24 transition-colors font-medium"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.lastName} 
                    onChange={(e) => handleUpdateField(row.id, 'lastName', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-28 transition-colors font-medium"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.phone} 
                    onChange={(e) => handleUpdateField(row.id, 'phone', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-28 transition-colors font-mono"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.email} 
                    onChange={(e) => handleUpdateField(row.id, 'email', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-36 transition-colors font-mono"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.title} 
                    onChange={(e) => handleUpdateField(row.id, 'title', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-44 transition-colors"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.website} 
                    onChange={(e) => handleUpdateField(row.id, 'website', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-32 transition-colors font-mono"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.address} 
                    onChange={(e) => handleUpdateField(row.id, 'address', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-56 transition-colors"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10">
                  <input 
                    type="text" 
                    value={row.telegram || ''} 
                    placeholder="t.me/ник"
                    onChange={(e) => handleUpdateField(row.id, 'telegram', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#42444A]/20 focus:bg-white focus:border-[#70B84F] focus:outline-none px-2 py-1 rounded text-[#42444A] w-28 transition-colors font-mono"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10 text-center">
                  <input 
                    type="checkbox" 
                    checked={row.maxMessenger !== false}
                    onChange={(e) => handleUpdateField(row.id, 'maxMessenger', e.target.checked)}
                    className="w-4 h-4 rounded text-[#70B84F] focus:ring-1 focus:ring-[#70B84F] cursor-pointer accent-[#70B84F]"
                  />
                </td>
                <td className="px-2.5 py-2 border-r border-[#42444A]/10 text-center">
                  <select
                    value={row.department}
                    onChange={(e) => handleUpdateField(row.id, 'department', e.target.value)}
                    className="bg-white border border-[#42444A]/20 hover:border-[#70B84F] text-[#42444A] focus:outline-none focus:border-[#70B84F] px-1.5 py-1 rounded text-[11px] font-medium"
                  >
                    {DEPARTMENTS.filter(d => d !== 'Все').map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer"
                    title="Удалить строку"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid Quick Creator */}
      <div className="mt-8 bg-[#E9E9E9]/40 p-5 rounded-2xl border border-[#42444A]/10">
        <h3 className="text-base font-bold text-[#42444A] mb-4 flex items-center space-x-2">
          <Plus size={18} className="text-[#70B84F]" />
          <span>Добавить новую строку сотрудника в таблицу</span>
        </h3>
        <form onSubmit={handleAddRow} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Имя *</label>
            <input
              type="text"
              required
              placeholder="Юрий"
              value={newRow.firstName}
              onChange={(e) => setNewRow({...newRow, firstName: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Фамилия *</label>
            <input
              type="text"
              required
              placeholder="Станиславский"
              value={newRow.lastName}
              onChange={(e) => setNewRow({...newRow, lastName: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Должность *</label>
            <input
              type="text"
              required
              placeholder="Директор по маркетингу"
              value={newRow.title}
              onChange={(e) => setNewRow({...newRow, title: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Отдел</label>
            <select
              value={newRow.department}
              onChange={(e) => setNewRow({...newRow, department: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            >
              {DEPARTMENTS.filter(d => d !== 'Все').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Телефон</label>
            <input
              type="text"
              placeholder="+7 812 200-77-06"
              value={newRow.phone}
              onChange={(e) => setNewRow({...newRow, phone: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">почта</label>
            <input
              type="email"
              placeholder="info@sdmaf.ru"
              value={newRow.email}
              onChange={(e) => setNewRow({...newRow, email: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Сайт</label>
            <input
              type="text"
              placeholder="www.sdmaf.ru"
              value={newRow.website}
              onChange={(e) => setNewRow({...newRow, website: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Адрес компании</label>
            <input
              type="text"
              placeholder="Санкт-Петербург, г. Колпино, Финлядская д. 3"
              value={newRow.address}
              onChange={(e) => setNewRow({...newRow, address: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#42444A] font-bold uppercase mb-1.5 tracking-wider">Ник в Telegram (без @)</label>
            <input
              type="text"
              placeholder="yur_stan"
              value={newRow.telegram}
              onChange={(e) => setNewRow({...newRow, telegram: e.target.value})}
              className="w-full bg-white border border-[#42444A]/15 rounded-xl px-3 py-2 text-[#42444A] focus:outline-none focus:border-[#70B84F] focus:ring-1 focus:ring-[#70B84F]"
            />
          </div>
          <div className="flex items-center h-full pt-3">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newRow.maxMessenger !== false}
                onChange={(e) => setNewRow({...newRow, maxMessenger: e.target.checked})}
                className="w-4 h-4 rounded text-[#70B84F] focus:ring-1 focus:ring-[#70B84F] cursor-pointer accent-[#70B84F]"
              />
              <span className="text-xs text-[#42444A] font-medium">Есть мессенджер МАКС</span>
            </label>
          </div>
          
          <div className="md:col-span-2 lg:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full bg-[#42444A] hover:bg-[#70B84F] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md cursor-pointer h-[40px] flex items-center justify-center gap-1.5 active:scale-[0.99]"
            >
              <Plus size={15} />
              <span>Добавить сотрудника в таблицу</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
