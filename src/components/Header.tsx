import React from 'react';
import { Smartphone, FileSpreadsheet, PhoneCall } from 'lucide-react';
import Logo from './Logo';
import { COMPANY_PHONE } from '../data';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogoClick: () => void;
}

export default function Header({ activeTab, setActiveTab, onLogoClick }: HeaderProps) {
  return (
    <header className="steel-nav sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={onLogoClick}
          className="flex items-center gap-3 cursor-pointer group transition-transform active:scale-[0.99]"
          title="На главную страницу визиток"
        >
          <div className="h-9 sm:h-10 flex items-center">
            <Logo className="h-8 sm:h-9 w-auto" />
          </div>
        </div>

        {/* Center/Right items: Company Phone & Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {/* Company Quick Phone Widget */}
          <a
            href={`tel:${COMPANY_PHONE.replace(/\s+/g, '')}`}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-[#42444A]/15 text-[#42444A] hover:border-[#70B84F] hover:text-[#70B84F] transition-all shadow-xs"
            title="Позвонить в компанию"
          >
            <PhoneCall size={15} className="text-[#70B84F]" />
            <span className="font-mono tracking-tight">{COMPANY_PHONE}</span>
          </a>

          {/* Tab Navigation */}
          <nav className="flex items-center bg-white/80 p-1 rounded-xl border border-[#42444A]/15 text-xs sm:text-sm shadow-xs">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'catalog' 
                  ? 'bg-[#42444A] text-white shadow-sm' 
                  : 'text-[#42444A] hover:text-[#70B84F] hover:bg-[#E9E9E9]/60'
              }`}
            >
              <Smartphone size={15} className={activeTab === 'catalog' ? 'text-[#70B84F]' : ''} />
              <span>Визитки</span>
            </button>
            
            <button
              onClick={() => setActiveTab('sheet-editor')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'sheet-editor' 
                  ? 'bg-[#42444A] text-white shadow-sm' 
                  : 'text-[#42444A] hover:text-[#70B84F] hover:bg-[#E9E9E9]/60'
              }`}
            >
              <FileSpreadsheet size={15} className={activeTab === 'sheet-editor' ? 'text-[#70B84F]' : ''} />
              <span>База (Sheets)</span>
            </button>
          </nav>
        </div>

      </div>
    </header>
  );
}
