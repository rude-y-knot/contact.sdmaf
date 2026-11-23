import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, ShieldAlert, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { api, ApiError } from '../services/api';
import { COMPANY_NAME } from '../data';

interface PasswordScreenProps {
  onSuccess: () => void;
}

export default function PasswordScreen({ onSuccess }: PasswordScreenProps) {
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getAuthStatus()
      .then((status) => {
        if (!active) return;
        if (status.authenticated) {
          onSuccess();
          return;
        }
        setNeedsSetup(status.needsSetup);
      })
      .catch(() => {
        if (active) {
          setErrorMessage('Не удалось подключиться к серверу базы данных.');
        }
      })
      .finally(() => {
        if (active) setCheckingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (needsSetup) {
      if (password.length < 6) {
        setErrorMessage('Пароль должен содержать минимум 6 символов.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Пароли не совпадают.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (needsSetup) {
        await api.setupAdminPassword(password);
      } else {
        await api.login(password);
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ошибка авторизации. Попробуйте ещё раз.');
      }
      setPassword('');
      setConfirmPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E9E9E9] flex flex-col items-center justify-center p-4 sm:p-6 antialiased text-[#42444A]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white rounded-2xl border border-[#42444A]/12 shadow-sm p-6 sm:p-8"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-10 mb-5 flex items-center">
            <Logo className="h-9 w-auto" />
          </div>

          <div className="w-11 h-11 rounded-xl bg-[#E9E9E9]/80 flex items-center justify-center text-[#42444A] mb-3.5">
            {needsSetup ? (
              <KeyRound size={20} className="text-[#70B84F]" />
            ) : (
              <Lock size={20} className="text-[#70B84F]" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[#42444A] tracking-tight">
            {needsSetup ? 'Настройка пароля администратора' : 'Вход в панель управления'}
          </h1>
          <p className="text-[#42444A]/70 mt-1.5 text-xs sm:text-sm leading-relaxed">
            {needsSetup
              ? `Первый запуск базы данных «${COMPANY_NAME}». Задайте пароль для управления визитками и конструктором PDF.`
              : `Управление базой визиток и конструктором PDF «${COMPANY_NAME}».`}
          </p>
        </div>

        {checkingStatus ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-xs text-[#42444A]/60">
            <div className="w-6 h-6 border-2 border-[#42444A]/20 border-t-[#70B84F] rounded-full animate-spin" />
            <span>Проверка подключения к базе данных...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-password"
                className="text-[#42444A] text-xs font-semibold block"
              >
                {needsSetup ? 'Новый пароль (минимум 6 символов)' : 'Пароль доступа'}
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isLoading}
                  placeholder={needsSetup ? 'Придумайте надёжный пароль...' : 'Введите пароль...'}
                  autoComplete={needsSetup ? 'new-password' : 'current-password'}
                  className={`w-full bg-[#E9E9E9]/50 text-[#42444A] border ${
                    errorMessage
                      ? 'border-amber-600 focus:ring-amber-500/30'
                      : 'border-[#42444A]/15 focus:border-[#70B84F] focus:ring-[#70B84F]/25'
                  } rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 transition-all pr-12 placeholder-[#42444A]/40`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#42444A]/60 hover:text-[#42444A] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {needsSetup && (
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password-confirm"
                  className="text-[#42444A] text-xs font-semibold block"
                >
                  Повторите пароль
                </label>
                <input
                  id="admin-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isLoading}
                  placeholder="Повторите пароль..."
                  autoComplete="new-password"
                  className="w-full bg-[#E9E9E9]/50 text-[#42444A] border border-[#42444A]/15 focus:border-[#70B84F] focus:ring-[#70B84F]/25 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 transition-all placeholder-[#42444A]/40"
                />
              </div>
            )}

            <AnimatePresence mode="wait">
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-start gap-2 text-amber-900 bg-amber-50 px-3.5 py-2.5 rounded-xl border border-amber-200 text-xs"
                >
                  <ShieldAlert size={15} className="shrink-0 mt-0.5 text-amber-700" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading || !password || (needsSetup && !confirmPassword)}
              className="w-full bg-[#42444A] hover:bg-[#70B84F] disabled:bg-[#42444A]/40 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{needsSetup ? 'Сохранить пароль и войти' : 'Войти'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
