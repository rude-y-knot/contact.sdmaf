import React from 'react';
import { Smartphone, Database, Printer, LogOut } from 'lucide-react';
import Logo from './Logo';

export type AdminTab = 'catalog' | 'database' | 'pdf-builder';

interface HeaderProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  onLogoClick: () => void;
  onLogout: () => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  onLogoClick,
  onLogout,
}: HeaderProps) {
  return (
    <header className="steel-nav sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand mark */}
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70B84F] rounded-lg"
          title="На главную страницу визиток"
        >
          <Logo className="h-8 w-auto" />
        </button>

        {/* Zone 2: Primary navigation tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-[#42444A] text-white'
                : 'text-[#42444A] hover:text-[#70B84F] hover:bg-white/70'
            }`}
          >
            <Smartphone size={15} className={activeTab === 'catalog' ? 'text-[#70B84F]' : ''} />
            <span>Визитки</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'database'
                ? 'bg-[#42444A] text-white'
                : 'text-[#42444A] hover:text-[#70B84F] hover:bg-white/70'
            }`}
          >
            <Database size={15} className={activeTab === 'database' ? 'text-[#70B84F]' : ''} />
            <span>База данных</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pdf-builder')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'pdf-builder'
                ? 'bg-[#42444A] text-white'
                : 'text-[#42444A] hover:text-[#70B84F] hover:bg-white/70'
            }`}
          >
            <Printer size={15} className={activeTab === 'pdf-builder' ? 'text-[#70B84F]' : ''} />
            <span>Конструктор PDF</span>
          </button>
        </nav>

        {/* Zone 3: Sign out action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-[#42444A]/80 hover:text-[#42444A] hover:bg-white/80 border border-transparent hover:border-[#42444A]/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Выйти из панели управления"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>
    </header>
  );
}
