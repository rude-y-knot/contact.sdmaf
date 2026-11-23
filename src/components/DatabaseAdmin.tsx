import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Building2,
  Check,
  Download,
  Edit3,
  Eye,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { CompanySettings, Employee } from '../types';
import { DEPARTMENTS } from '../data';
import { api, ApiError } from '../services/api';

interface DatabaseAdminProps {
  employees: Employee[];
  settings: CompanySettings;
  onRefresh: () => Promise<void>;
  onOpenCard: (emp: Employee) => void;
  onOpenPdfBuilder: (emp: Employee) => void;
  onNotify: (msg: string) => void;
  parseCsvEmployees: (csvText: string) => Array<Omit<Employee, 'id'> & { id?: string }>;
}

type StatusFilter = 'active' | 'archived' | 'all';

interface EmployeeFormState {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  telegram: string;
  maxMessenger: boolean;
  isActive: boolean;
}

const DEPARTMENT_OPTIONS = DEPARTMENTS.filter((d) => d !== 'Все');

function buildEmptyForm(settings: CompanySettings): EmployeeFormState {
  return {
    id: '',
    firstName: '',
    lastName: '',
    title: '',
    department: 'Продажи',
    phone: '',
    email: '',
    website: settings.companyWebsite,
    address: settings.companyAddress,
    telegram: '',
    maxMessenger: true,
    isActive: true,
  };
}

export default function DatabaseAdmin({
  employees,
  settings,
  onRefresh,
  onOpenCard,
  onOpenPdfBuilder,
  onNotify,
  parseCsvEmployees,
}: DatabaseAdminProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(() => buildEmptyForm(settings));
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settingsForm, setSettingsForm] = useState<CompanySettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvReplaceAll, setCsvReplaceAll] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);

  const activeCount = useMemo(
    () => employees.filter((e) => e.isActive !== false).length,
    [employees]
  );
  const archivedCount = employees.length - activeCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const isAct = emp.isActive !== false;
      if (statusFilter === 'active' && !isAct) return false;
      if (statusFilter === 'archived' && isAct) return false;
      if (!q) return true;
      return (
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
        emp.title.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q)
      );
    });
  }, [employees, search, statusFilter]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(buildEmptyForm(settings));
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      title: emp.title,
      department: emp.department || 'Продажи',
      phone: emp.phone || '',
      email: emp.email || '',
      website: emp.website || settings.companyWebsite,
      address: emp.address || settings.companyAddress,
      telegram: emp.telegram || '',
      maxMessenger: Boolean(emp.maxMessenger),
      isActive: emp.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.title.trim()) {
      onNotify('Заполните имя, фамилию и должность.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        title: form.title.trim(),
        department: form.department.trim() || 'Продажи',
        phone: form.phone.trim(),
        email: form.email.trim(),
        website: form.website.trim() || settings.companyWebsite,
        address: form.address.trim() || settings.companyAddress,
        telegram: form.telegram.trim(),
        whatsapp: form.phone.replace(/[^0-9]/g, ''),
        maxMessenger: form.maxMessenger,
        isActive: form.isActive,
      };

      if (editingId) {
        await api.updateEmployee(editingId, payload);
        onNotify(`Сохранено в БД: ${payload.firstName} ${payload.lastName}`);
      } else {
        await api.createEmployee({
          ...payload,
          id: form.id.trim() || undefined,
        });
        onNotify(`Добавлен сотрудник: ${payload.firstName} ${payload.lastName}`);
      }
      await onRefresh();
      setIsModalOpen(false);
    } catch (err) {
      onNotify(err instanceof ApiError ? err.message : 'Не удалось сохранить запись.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async (emp: Employee) => {
    const nextActive = emp.isActive === false;
    try {
      await api.setEmployeeArchive(emp.id, nextActive);
      await onRefresh();
      onNotify(
        nextActive
          ? `Визитка ${emp.firstName} ${emp.lastName} восстановлена`
          : `Визитка ${emp.firstName} ${emp.lastName} перенесена в архив`
      );
    } catch (err) {
      onNotify(err instanceof ApiError ? err.message : 'Ошибка изменения статуса.');
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    try {
      await api.deleteEmployee(emp.id);
      setConfirmDeleteId(null);
      await onRefresh();
      onNotify(`Запись ${emp.firstName} ${emp.lastName} удалена из базы.`);
    } catch (err) {
      onNotify(err instanceof ApiError ? err.message : 'Не удалось удалить запись.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateSettings(settingsForm);
      await onRefresh();
      setShowSettingsPanel(false);
      onNotify('Реквизиты компании обновлены в SQLite.');
    } catch (err) {
      onNotify(err instanceof ApiError ? err.message : 'Ошибка сохранения реквизитов.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await api.exportCsvFile();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sdmaf_employees_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onNotify('База выгружена в CSV.');
    } catch (err) {
      onNotify(err instanceof ApiError ? err.message : 'Ошибка экспорта CSV.');
    }
  };

  const handleImportCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mapped = parseCsvEmployees(csvText);
    if (mapped.length === 0) {
      onNotify('Не удалось распознать строки CSV. Проверьте формат колонок.');
      return;
    }

    setImportingCsv(true);
    try {
      const res = await api.importCsvEmployees(mapped, csvReplaceAll);
      await onRefresh();
      setCsvText('');
      setShowCsvPanel(false);
      onNotify(`Импорт завершён: добавлено ${res.created}, обновлено ${res.updated}.`);
    } catch (err) {
      onNotify(err instanceof ApiError ? err.message : 'Ошибка импорта CSV.');
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#42444A]/12 overflow-hidden">
      {/* Header Toolbar */}
      <div className="p-5 sm:p-6 border-b border-[#42444A]/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#42444A] tracking-tight">
            База визиток (SQLite)
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#42444A]/65 tabular-nums">
            <span>Активных: {activeCount}</span>
            <span aria-hidden="true">·</span>
            <span>В архиве: {archivedCount}</span>
            <span aria-hidden="true">·</span>
            <span>Изменения сразу применяются на сайте и в PDF</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSettingsForm(settings);
              setShowSettingsPanel((v) => !v);
              setShowCsvPanel(false);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#42444A]/15 text-[#42444A] hover:border-[#70B84F] hover:text-[#70B84F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Building2 size={14} />
            <span>Реквизиты</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCsvPanel((v) => !v);
              setShowSettingsPanel(false);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#42444A]/15 text-[#42444A] hover:border-[#70B84F] hover:text-[#70B84F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload size={14} />
            <span>Импорт CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#42444A]/15 text-[#42444A] hover:border-[#70B84F] hover:text-[#70B84F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download size={14} />
            <span>Экспорт CSV</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#42444A] hover:bg-[#70B84F] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span>Добавить сотрудника</span>
          </button>
        </div>
      </div>

      {/* Collapsible Company Settings Panel */}
      {showSettingsPanel && (
        <form
          onSubmit={handleSaveSettings}
          className="p-5 sm:p-6 bg-[#E9E9E9]/40 border-b border-[#42444A]/10 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#42444A]">Общие реквизиты компании</h2>
              <p className="text-xs text-[#42444A]/65 mt-0.5">
                Используются по умолчанию на визитках, в vCard и в конструкторе PDF CMYK.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsPanel(false)}
              className="p-1.5 text-[#42444A]/60 hover:text-[#42444A] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#42444A]/80 mb-1">Название</label>
              <input
                type="text"
                value={settingsForm.companyName}
                onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                className="w-full bg-white border border-[#42444A]/15 rounded-lg px-3 py-2 text-xs text-[#42444A] focus:outline-none focus:border-[#70B84F]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#42444A]/80 mb-1">Общий телефон</label>
              <input
                type="text"
                value={settingsForm.companyPhone}
                onChange={(e) => setSettingsForm({ ...settingsForm, companyPhone: e.target.value })}
                className="w-full bg-white border border-[#42444A]/15 rounded-lg px-3 py-2 text-xs font-mono text-[#42444A] focus:outline-none focus:border-[#70B84F]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#42444A]/80 mb-1">Сайт</label>
              <input
                type="text"
                value={settingsForm.companyWebsite}
                onChange={(e) => setSettingsForm({ ...settingsForm, companyWebsite: e.target.value })}
                className="w-full bg-white border border-[#42444A]/15 rounded-lg px-3 py-2 text-xs font-mono text-[#42444A] focus:outline-none focus:border-[#70B84F]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#42444A]/80 mb-1">Адрес</label>
              <input
                type="text"
                value={settingsForm.companyAddress}
                onChange={(e) => setSettingsForm({ ...settingsForm, companyAddress: e.target.value })}
                className="w-full bg-white border border-[#42444A]/15 rounded-lg px-3 py-2 text-xs text-[#42444A] focus:outline-none focus:border-[#70B84F]"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowSettingsPanel(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#42444A]/70 hover:text-[#42444A] cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#42444A] hover:bg-[#70B84F] text-white transition-colors cursor-pointer"
            >
              <Check size={14} />
              <span>{savingSettings ? 'Сохранение...' : 'Сохранить реквизиты'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Collapsible CSV Import Panel */}
      {showCsvPanel && (
        <form
          onSubmit={handleImportCsvSubmit}
          className="p-5 sm:p-6 bg-[#E9E9E9]/40 border-b border-[#42444A]/10 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#42444A]">Импорт сотрудников из CSV / Excel</h2>
              <p className="text-xs text-[#42444A]/65 mt-0.5">
                Вставьте строки таблицы с заголовками (Имя, Фамилия, Телефон, Почта, Должность, Департамент, Сайт, Адрес, Мессенджер Макс, Telegram).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCsvPanel(false)}
              className="p-1.5 text-[#42444A]/60 hover:text-[#42444A] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Имя,Фамилия,Телефон,Почта,Должность,Департамент..."
            className="w-full bg-white border border-[#42444A]/15 rounded-xl p-3 text-xs font-mono text-[#42444A] focus:outline-none focus:border-[#70B84F]"
            required
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-[#42444A] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={csvReplaceAll}
                onChange={(e) => setCsvReplaceAll(e.target.checked)}
                className="accent-[#70B84F] rounded"
              />
              <span>Заменить всю текущую базу (иначе существующие обновятся по слагу, новые добавятся)</span>
            </label>

            <button
              type="submit"
              disabled={importingCsv || !csvText.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#42444A] hover:bg-[#70B84F] disabled:bg-[#42444A]/40 text-white transition-colors cursor-pointer shrink-0"
            >
              {importingCsv ? 'Импорт...' : 'Загрузить в SQLite'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filters */}
      <div className="px-5 sm:px-6 py-4 border-b border-[#42444A]/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#42444A]/45"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, должности, телефону или URL-слагу..."
            className="w-full bg-[#E9E9E9]/50 border border-[#42444A]/12 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-[#42444A] placeholder-[#42444A]/45 focus:outline-none focus:bg-white focus:border-[#70B84F]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#E9E9E9]/70 rounded-xl self-start sm:self-auto">
          {(
            [
              { id: 'active', label: `Активные (${activeCount})` },
              { id: 'archived', label: `Архив (${archivedCount})` },
              { id: 'all', label: `Все (${employees.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                statusFilter === tab.id
                  ? 'bg-white text-[#42444A] shadow-2xs'
                  : 'text-[#42444A]/70 hover:text-[#42444A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-14 text-center px-4">
            <p className="text-sm font-semibold text-[#42444A]">Записи не найдены</p>
            <p className="text-xs text-[#42444A]/60 mt-1">
              Измените фильтр или добавьте нового сотрудника в базу данных.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#42444A]/10 bg-[#E9E9E9]/35 text-[11px] font-semibold text-[#42444A]/65">
                <th className="py-3 px-4 sm:px-6">Сотрудник и URL</th>
                <th className="py-3 px-4">Должность и отдел</th>
                <th className="py-3 px-4">Контакты</th>
                <th className="py-3 px-4">Мессенджеры</th>
                <th className="py-3 px-4 sm:px-6 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#42444A]/8 text-xs">
              {filtered.map((emp) => {
                const isArchived = emp.isActive === false;
                return (
                  <tr
                    key={emp.id}
                    className={`transition-colors hover:bg-[#E9E9E9]/30 ${
                      isArchived ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 sm:px-6 align-top">
                      <div className="font-semibold text-[#42444A] text-sm">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-[11px] font-mono text-[#42444A]/55 mt-0.5">
                        ?card={emp.id}
                        {isArchived && <span className="ml-2 text-amber-700">· Архив</span>}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="text-[#42444A] font-medium">{emp.title}</div>
                      <div className="text-[11px] text-[#42444A]/60 mt-0.5">{emp.department}</div>
                    </td>

                    <td className="py-3.5 px-4 align-top font-mono tabular-nums space-y-0.5">
                      <div className="text-[#42444A]">
                        {emp.phone || (
                          <span className="text-[#42444A]/45 font-sans">
                            Общий ({settings.companyPhone})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#42444A]/65">
                        {emp.email || '—'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top text-[#42444A]/75">
                      <div>
                        Telegram: {emp.telegram ? <span className="font-mono">@{emp.telegram}</span> : '—'}
                      </div>
                      <div className="text-[11px] text-[#42444A]/60 mt-0.5">
                        МАКС: {emp.maxMessenger ? 'Есть' : 'Нет'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 align-top text-right">
                      {confirmDeleteId === emp.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-[11px] text-red-700 font-medium mr-1">Удалить?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp)}
                            className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer"
                          >
                            Да
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 rounded-lg border border-[#42444A]/15 text-[#42444A] text-[11px] hover:bg-[#E9E9E9] cursor-pointer"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenCard(emp)}
                            title="Открыть электронную визитку"
                            className="p-2 rounded-lg text-[#42444A]/70 hover:text-[#70B84F] hover:bg-[#E9E9E9]/70 transition-colors cursor-pointer"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPdfBuilder(emp)}
                            title="Сгенерировать PDF CMYK (50×90)"
                            className="p-2 rounded-lg text-[#42444A]/70 hover:text-[#70B84F] hover:bg-[#E9E9E9]/70 transition-colors cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(emp)}
                            title="Редактировать"
                            className="p-2 rounded-lg text-[#42444A]/70 hover:text-[#42444A] hover:bg-[#E9E9E9]/70 transition-colors cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(emp)}
                            title={isArchived ? 'Восстановить из архива' : 'Перенести в архив'}
                            className="p-2 rounded-lg text-[#42444A]/70 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            {isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(emp.id)}
                            title="Удалить навсегда"
                            className="p-2 rounded-lg text-[#42444A]/50 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#42444A]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#42444A]/15 shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#42444A]/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#42444A]">
                  {editingId ? 'Редактирование визитки' : 'Новый сотрудник'}
                </h2>
                {editingId && (
                  <p className="text-[11px] font-mono text-[#42444A]/55 mt-0.5">
                    Постоянный URL-слаг: ?card={editingId} (сохраняется для печатных QR)
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[#42444A]/60 hover:text-[#42444A] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">Имя *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">Фамилия *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">Должность *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">Департамент</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                  >
                    {Array.from(new Set([...DEPARTMENT_OPTIONS, form.department])).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">
                    Личный телефон (можно оставить пустым)
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+79210000000"
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@sdmaf.ru"
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">
                    Telegram (ник без @)
                  </label>
                  <input
                    type="text"
                    value={form.telegram}
                    onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                    placeholder="sdmaf_sale"
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">Сайт</label>
                  <input
                    type="text"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#42444A] mb-1">Адрес</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                  />
                </div>

                {!editingId && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#42444A] mb-1">
                      URL-слаг (опционально, сгенерируется автоматически из ФИО)
                    </label>
                    <input
                      type="text"
                      value={form.id}
                      onChange={(e) => setForm({ ...form, id: e.target.value })}
                      placeholder="ivan-petrov"
                      className="w-full bg-[#E9E9E9]/45 border border-[#42444A]/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#42444A] focus:outline-none focus:bg-white focus:border-[#70B84F]"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-[#42444A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.maxMessenger}
                    onChange={(e) => setForm({ ...form, maxMessenger: e.target.checked })}
                    className="accent-[#70B84F]"
                  />
                  <span>Мессенджер МАКС доступен</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#42444A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="accent-[#70B84F]"
                  />
                  <span>Визитка активна (открывается по QR-ссылке)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-[#42444A]/10 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#42444A]/75 hover:bg-[#E9E9E9] transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#42444A] hover:bg-[#70B84F] disabled:bg-[#42444A]/40 text-white transition-colors cursor-pointer"
                >
                  {isSaving ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Создать визитку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
