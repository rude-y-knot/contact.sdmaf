import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { COMPANY_NAME } from '../data';

interface PasswordScreenProps {
  onSuccess: () => void;
}

export default function PasswordScreen({ onSuccess }: PasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sha256 = async (text: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    try {
      const enteredHash = await sha256(password);
      // SHA-256 hash of "STD1488$"
      const targetHash = 'bf0ca6bad2645d562693eac19c8284da8fbbc332fa0e0fd9ac132c3d64b6de5a';
      
      if (enteredHash === targetHash || password === 'STD1488$') {
        setTimeout(() => {
          setIsLoading(false);
          sessionStorage.setItem('stalnoe_auth', 'true');
          sessionStorage.setItem('magma_auth', 'true');
          onSuccess();
        }, 600);
      } else {
        setIsLoading(false);
        setError(true);
        setPassword('');
        if ('vibrate' in navigator) {
          navigator.vibrate(100);
        }
      }
    } catch (err) {
      console.error('Password hashing failed:', err);
      setIsLoading(false);
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#E9E9E9] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden antialiased text-[#42444A]">
      {/* Background ambient accents */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#70B84F]/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="absolute top-10 left-1/2 -translate-x-1/2 text-[#42444A]/60 font-mono text-[10px] tracking-widest uppercase pointer-events-none text-center">
        {COMPANY_NAME} • Защищенный доступ
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#42444A]/10 p-6 sm:p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-[#42444A] via-[#70B84F] to-[#42444A]"></div>
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-10 mb-4 flex items-center">
            <Logo className="h-9 w-auto" />
          </div>

          <div className="w-12 h-12 rounded-full bg-[#E9E9E9] flex items-center justify-center text-[#42444A] border border-[#42444A]/10 mb-3">
            <Lock size={20} className="text-[#70B84F]" />
          </div>
          
          <h2 className="text-xl sm:text-2xl font-bold text-[#42444A] tracking-tight">
            Вход в Панель Управления
          </h2>
          <p className="text-[#42444A]/70 mt-1.5 text-xs sm:text-sm">
            Список сотрудников и управление таблицей защищены паролем.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[#42444A] text-xs font-semibold tracking-wider uppercase pl-1 block">
              Пароль Доступа
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                disabled={isLoading}
                placeholder="Введите пароль..."
                className={`w-full bg-[#E9E9E9]/60 text-[#42444A] border ${
                  error ? 'border-amber-600 focus:ring-amber-500' : 'border-[#42444A]/15 focus:border-[#70B84F] focus:ring-[#70B84F]/30'
                } rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 transition-all pr-12 placeholder-[#42444A]/40`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#42444A]/60 hover:text-[#42444A] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Feedback/Errors */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 text-amber-800 bg-amber-50 px-3.5 py-2.5 rounded-lg border border-amber-200 text-xs"
              >
                <ShieldAlert size={14} className="flex-shrink-0 text-amber-700" />
                <span>Неверный пароль. Пожалуйста, попробуйте еще раз.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button: #42444A default, #70B84F hover */}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-[#42444A] hover:bg-[#70B84F] disabled:bg-[#42444A]/40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.99]"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Войти</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
