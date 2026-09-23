import React, { useState, useRef } from 'react';
import { Employee } from '../types';
import { 
  Phone, Mail, Globe, MapPin, ExternalLink, Download, Copy, Check, Send, 
  MessageSquare, ShieldCheck, QrCode, Palette, Megaphone, Wrench, Award, 
  TrendingUp, Users, Coins, Briefcase, Compass, PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import Logo from './Logo';
import { COMPANY_NAME, COMPANY_PHONE } from '../data';

const getDepartmentIcon = (dept: string) => {
  const d = dept ? dept.trim().toLowerCase() : '';
  if (d.includes('дизайн')) return <Palette size={32} className="text-[#70B84F]" />;
  if (d.includes('маркетинг')) return <Megaphone size={32} className="text-[#70B84F]" />;
  if (d.includes('производство') || d.includes('металл') || d.includes('цех')) return <Wrench size={32} className="text-[#70B84F]" />;
  if (d.includes('проектирование') || d.includes('конструктор') || d.includes('инженер')) return <Compass size={32} className="text-[#70B84F]" />;
  if (d.includes('управление') || d.includes('руководство') || d.includes('директор')) return <Award size={32} className="text-[#70B84F]" />;
  if (d.includes('продажи')) return <TrendingUp size={32} className="text-[#70B84F]" />;
  if (d.includes('кадры') || d.includes('персонал')) return <Users size={32} className="text-[#70B84F]" />;
  if (d.includes('финансы') || d.includes('бухгалтерия')) return <Coins size={32} className="text-[#70B84F]" />;
  return <Briefcase size={32} className="text-[#70B84F]" />;
};

interface CardViewProps {
  employee: Employee;
  onDownloadVCF: (emp: Employee) => void;
  onCopyLink: (emp: Employee) => void;
  standalone?: boolean;
}

export default function CardView({ employee, onDownloadVCF, onCopyLink, standalone = true }: CardViewProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    onCopyLink(employee);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cardUrl = `${window.location.origin}${window.location.pathname}?card=${employee.id}`;

  const downloadSVG = () => {
    const container = qrContainerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${employee.lastName}_${employee.firstName}_qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Business Card Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.97, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#42444A]/10 relative overflow-hidden text-[#42444A]"
        style={{ boxShadow: '0 20px 40px -15px rgba(66, 68, 74, 0.15), 0 0 1px 1px rgba(66, 68, 74, 0.05)' }}
      >
        {/* Top Accent line in Green #70B84F */}
        <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-[#42444A] via-[#70B84F] to-[#42444A]"></div>
        
        {/* Subtle decorative background glow */}
        <div className="absolute -top-28 -right-28 w-64 h-64 bg-[#70B84F]/10 rounded-full blur-[70px] pointer-events-none"></div>
        <div className="absolute -bottom-28 -left-28 w-64 h-64 bg-[#42444A]/5 rounded-full blur-[70px] pointer-events-none"></div>
        
        {/* Content Box */}
        <div className="p-6 sm:p-8 relative z-10 flex flex-col justify-between min-h-[600px]">
          
          <div>
            {/* Top Logo Mark */}
            <div className="flex flex-col items-center mb-6">
              <div className="h-9 flex items-center">
                <Logo className="h-8 w-auto" />
              </div>
              <div className="h-[2px] w-12 bg-[#70B84F] mt-3 rounded-full"></div>
            </div>

            {/* Avatar / Icon & Verification Indicator */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#70B84F] via-[#E9E9E9] to-white p-[2px] shadow-md mb-3.5 relative">
                <div className="w-full h-full rounded-full bg-[#E9E9E9] flex items-center justify-center border border-white">
                  {getDepartmentIcon(employee.department)}
                </div>
                <div className="absolute bottom-0 right-0 bg-[#70B84F] text-white p-1 rounded-full border-2 border-white shadow-sm flex items-center justify-center" title="Верифицированный сотрудник">
                  <ShieldCheck size={13} />
                </div>
              </div>

              {/* Name & Title */}
              <h2 className="text-2xl font-bold text-[#42444A] tracking-tight leading-snug">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-[#42444A] text-xs font-semibold tracking-wider uppercase mt-2 bg-[#70B84F]/15 px-3 py-1 rounded-full border border-[#70B84F]/30 inline-block">
                {employee.title}
              </p>
              
              <div className="mt-2.5 text-xs text-[#42444A]/70 font-medium">
                <span>{employee.department} • {COMPANY_NAME}</span>
              </div>
            </div>

            {/* Actions & Contacts */}
            <div className="mt-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <a 
                  href={`tel:${employee.phone || COMPANY_PHONE}`}
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-[#E9E9E9]/80 hover:bg-[#70B84F] text-[#42444A] hover:text-white rounded-xl border border-[#42444A]/10 transition-all text-xs sm:text-sm font-semibold shadow-xs cursor-pointer active:scale-95"
                >
                  <Phone size={15} />
                  <span>Позвонить</span>
                </a>
                <a 
                  href={`mailto:${employee.email}`}
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-[#E9E9E9]/80 hover:bg-[#70B84F] text-[#42444A] hover:text-white rounded-xl border border-[#42444A]/10 transition-all text-xs sm:text-sm font-semibold shadow-xs cursor-pointer active:scale-95"
                >
                  <Mail size={15} />
                  <span>Написать</span>
                </a>
              </div>

              {/* Chat Platforms */}
              <div className="space-y-2">
                {employee.telegram && (() => {
                  const tgUser = employee.telegram.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').replace(/\/$/, '');
                  return (
                    <a 
                      href={`https://t.me/${tgUser}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-between px-3.5 py-2.5 bg-[#E9E9E9]/50 hover:bg-[#E9E9E9] rounded-xl border border-[#42444A]/10 text-[#42444A] hover:border-[#70B84F]/40 transition-all text-xs"
                    >
                      <span className="flex items-center space-x-2">
                        <Send size={14} className="text-[#70B84F] transform rotate-[-30deg]" />
                        <span className="font-semibold">Telegram</span>
                      </span>
                      <span className="text-xs text-[#42444A]/80 font-mono">@{tgUser}</span>
                    </a>
                  );
                })()}

                {employee.whatsapp && (
                  <a 
                    href={`https://wa.me/${employee.whatsapp}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-between px-3.5 py-2.5 bg-[#E9E9E9]/50 hover:bg-[#E9E9E9] rounded-xl border border-[#42444A]/10 text-[#42444A] hover:border-[#70B84F]/40 transition-all text-xs"
                  >
                    <span className="flex items-center space-x-2">
                      <MessageSquare size={14} className="text-[#70B84F]" />
                      <span className="font-semibold">WhatsApp</span>
                    </span>
                    <span className="text-xs text-[#42444A]/80 font-mono">+{employee.whatsapp}</span>
                  </a>
                )}

                {employee.phone && employee.maxMessenger !== false && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#E9E9E9]/50 rounded-xl border border-[#42444A]/10 text-xs select-none">
                    <span className="flex items-center space-x-2">
                      <MessageSquare size={14} className="text-[#70B84F]" />
                      <span className="font-semibold text-[#42444A]">Мессенджер МАКС</span>
                    </span>
                    <span className="text-[10px] bg-[#70B84F]/15 text-[#42444A] px-2 py-0.5 rounded-full border border-[#70B84F]/30 font-semibold">
                      на этом номере
                    </span>
                  </div>
                )}
              </div>

              {/* Physical Details & Company Coordinates */}
              <div className="bg-[#E9E9E9]/60 p-3.5 rounded-xl border border-[#42444A]/10 text-xs space-y-2.5">
                {/* Company Main Phone */}
                <div className="flex items-center justify-between text-[#42444A]">
                  <span className="text-[#42444A]/70 flex items-center gap-1.5 shrink-0">
                    <PhoneCall size={13} className="text-[#70B84F]" />
                    Офис компании:
                  </span>
                  <a 
                    href={`tel:${COMPANY_PHONE.replace(/\s+/g, '')}`}
                    className="text-[#42444A] hover:text-[#70B84F] font-mono font-bold transition-colors"
                  >
                    {COMPANY_PHONE}
                  </a>
                </div>

                {employee.website && (
                  <div className="flex items-center justify-between text-[#42444A]">
                    <span className="text-[#42444A]/70 flex items-center gap-1.5 shrink-0">
                      <Globe size={13} className="text-[#70B84F]" />
                      Сайт:
                    </span>
                    <a 
                      href={`https://${employee.website}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[#42444A] hover:text-[#70B84F] font-medium flex items-center gap-1 truncate"
                    >
                      {employee.website}
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  </div>
                )}
                
                {employee.address && (
                  <div className="text-[#42444A] pt-1 border-t border-[#42444A]/10">
                    <span className="text-[#42444A]/70 flex items-center gap-1.5 mb-1">
                      <MapPin size={13} className="text-[#70B84F]" />
                      Адрес:
                    </span>
                    <a 
                      href={`https://yandex.ru/maps/?text=${encodeURIComponent(employee.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#42444A] hover:text-[#70B84F] flex items-start space-x-1.5 group/link"
                    >
                      <span className="underline decoration-dotted decoration-[#42444A]/40 group-hover/link:decoration-[#70B84F] transition-all text-[11px] leading-relaxed">
                        {employee.address}
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="mt-6 space-y-2.5">
            {/* Primary Action Button: #42444A default, #70B84F hover */}
            <button
              onClick={() => onDownloadVCF(employee)}
              className="w-full bg-[#42444A] hover:bg-[#70B84F] text-white py-3 px-4 rounded-xl font-bold text-xs sm:text-sm tracking-wide shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
            >
              <Download size={16} />
              <span>Сохранить контакт (VCF)</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleCopy}
                className="w-full bg-[#E9E9E9]/80 hover:bg-white text-[#42444A] hover:text-[#70B84F] py-2.5 px-3 rounded-xl text-xs font-semibold border border-[#42444A]/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-[#70B84F]" />
                    <span className="text-[#70B84F] font-bold">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Поделиться</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowQr(!showQr)}
                className="w-full bg-[#E9E9E9]/80 hover:bg-white text-[#42444A] hover:text-[#70B84F] py-2.5 px-3 rounded-xl text-xs font-semibold border border-[#42444A]/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
              >
                <QrCode size={14} />
                <span>QR-код</span>
              </button>
            </div>

            <AnimatePresence>
              {showQr && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="bg-[#E9E9E9]/70 p-4 rounded-xl border border-[#42444A]/15 flex flex-col items-center space-y-3 shadow-inner overflow-hidden"
                >
                  <div ref={qrContainerRef} className="p-3 bg-white rounded-xl inline-block shadow-md border border-[#42444A]/10">
                    <QRCode
                      value={cardUrl}
                      size={130}
                      fgColor="#42444A"
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox={`0 0 256 256`}
                    />
                  </div>
                  <button
                    onClick={downloadSVG}
                    className="flex items-center gap-1.5 text-xs text-[#42444A] hover:text-white transition-colors font-semibold border border-[#42444A]/20 px-3 py-1.5 rounded-lg bg-white hover:bg-[#70B84F] hover:border-[#70B84F] shadow-2xs cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Скачать QR-код (SVG)</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center text-[10px] text-[#42444A]/60 font-mono pt-1.5 uppercase tracking-wider">
              {COMPANY_NAME} • ЭЛЕКТРОННАЯ ВИЗИТКА
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-4 text-center max-w-xs text-xs text-[#42444A]/70 leading-relaxed px-4">
        Визитная карточка оптимизирована для сохранения в смартфон и Apple / Google Wallet.
      </div>
    </div>
  );
}
