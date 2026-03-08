'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { AxiosError } from 'axios';
import {
  formatPhone,
  extractPhoneDigits,
  validateName,
  validateEmail,
  validatePhone,
  PHONE_DIGITS_COUNT,
} from '@/lib/validation';

type RegStep = 'phone' | 'otp' | 'details';

const PASSWORD_RULES = [
  { id: 'length', label: 'Минимум 8 символов',                test: (p: string) => p.length >= 8 },
  { id: 'upper',  label: 'Хотя бы одна заглавная буква (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',  label: 'Хотя бы одна строчная буква (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit',  label: 'Хотя бы одна цифра (0-9)',           test: (p: string) => /[0-9]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Step control
  const [regStep, setRegStep] = useState<RegStep>('phone');
  const [botUsername, setBotUsername] = useState('');

  // Step 1 – phone & OTP
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Step 2 – details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false });
  const [showPassword, setShowPassword] = useState(false);
  const [emailDeliverable, setEmailDeliverable] = useState<boolean | null>(null);
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);

  // Password UX
  const [showRules, setShowRules] = useState(false);
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPassedRef = useRef<string[]>([]);

  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const phoneError = validatePhone(phone, phoneTouched);
  const nameError = validateName(name, touched.name);
  const emailError = validateEmail(email, touched.email);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const withoutPrefix = raw.startsWith('+7') ? raw.slice(2) : raw;
    const digits = withoutPrefix.replace(/\D/g, '').slice(0, PHONE_DIGITS_COUNT);
    setPhone(digits ? formatPhone(digits) : '');
  };

  const passwordRules = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));
  const passwordValid = passwordRules.every((r) => r.passed);

  const handlePasswordChange = (newVal: string) => {
    setPassword(newVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!newVal) { setShowRules(false); prevPassedRef.current = []; return; }
    if (showRules) {
      const nowPassed = PASSWORD_RULES.filter((r) => r.test(newVal)).map((r) => r.id);
      const newlyPassed = nowPassed.filter((id) => !prevPassedRef.current.includes(id));
      if (newlyPassed.length > 0) {
        setFadingIds((prev) => [...new Set([...prev, ...newlyPassed])]);
        setTimeout(() => {
          setFadingIds((prev) => prev.filter((id) => !newlyPassed.includes(id)));
        }, 700);
      }
      prevPassedRef.current = nowPassed;
    } else {
      timerRef.current = setTimeout(() => {
        prevPassedRef.current = PASSWORD_RULES.filter((r) => r.test(newVal)).map((r) => r.id);
        setShowRules(true);
      }, 1500);
    }
  };

  const handlePasswordBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (password && !showRules) {
      prevPassedRef.current = PASSWORD_RULES.filter((r) => r.test(password)).map((r) => r.id);
      setShowRules(true);
    }
  };

  // ─── Step 1a: Request OTP ─────────────────────────────────
  const handleRequestOtp = async () => {
    setPhoneTouched(true);
    const digits = extractPhoneDigits(phone);
    if (digits.length !== PHONE_DIGITS_COUNT) {
      toast.error('Введите номер телефона полностью');
      return;
    }
    setIsRequestingOtp(true);
    try {
      const phoneFormatted = `+7${digits}`;
      const { data } = await api.post('/auth/request-otp', { phone: phoneFormatted });
      setBotUsername(data.botUsername ?? '');
      toast.success('Код запрошен! Откройте бот в Telegram и поделитесь контактом.');
      setRegStep('otp');
    } catch (error) {
      if (error instanceof AxiosError) {
        const msg = error.response?.data?.message;
        if (msg === 'Phone already registered') {
          toast.error('Пользователь с таким номером уже зарегистрирован');
        } else {
          toast.error(msg ?? 'Ошибка запроса кода');
        }
      } else {
        toast.error('Ошибка запроса кода');
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // ─── Step 1b: Verify OTP ──────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const phoneFormatted = `+7${extractPhoneDigits(phone)}`;
      await api.post('/auth/verify-otp', { phone: phoneFormatted, code: otpCode });
      toast.success('Номер подтверждён!');
      setRegStep('details');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Неверный или истёкший код');
      } else {
        toast.error('Ошибка подтверждения');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ─── Email blur validation ────────────────────────────────
  const handleEmailBlur = async () => {
    touch('email');
    if (!email || validateEmail(email, true)) return;
    setIsValidatingEmail(true);
    try {
      const { data } = await api.post('/auth/validate-email', { email });
      setEmailDeliverable(data.deliverable);
      if (!data.deliverable) {
        toast.error(data.message ?? 'Email недоступен. Проверьте адрес.');
      }
    } catch {
      setEmailDeliverable(null); // fail-open
    } finally {
      setIsValidatingEmail(false);
    }
  };

  // ─── Final registration submit ─────────────────────────────
  const isFormValid =
    !validateName(name, true) &&
    !validateEmail(email, true) &&
    passwordValid &&
    emailDeliverable !== false;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ name: true, email: true });
    if (password && !showRules) {
      prevPassedRef.current = PASSWORD_RULES.filter((r) => r.test(password)).map((r) => r.id);
      setShowRules(true);
    }
    if (!isFormValid) return;

    try {
      const phoneFormatted = `+7${extractPhoneDigits(phone)}`;
      await register({ name, email, password, phone: phoneFormatted });
      toast.success('Регистрация успешна');
      router.push('/catalog');
    } catch (error) {
      if (error instanceof AxiosError) {
        const msg = error.response?.data?.message;
        if (msg === 'Email already registered') {
          toast.error('Пользователь с таким email уже зарегистрирован');
        } else if (msg === 'Phone already registered') {
          toast.error('Пользователь с таким номером телефона уже зарегистрирован');
        } else {
          toast.error(msg ?? 'Ошибка регистрации');
        }
      } else {
        toast.error('Ошибка регистрации');
      }
    }
  };

  return (
    <Card className="shadow-lg border-border/60 rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-center text-2xl" style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}>
          Регистрация
        </CardTitle>
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mt-2">
          {(['phone', 'otp', 'details'] as RegStep[]).map((s, i) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                regStep === s
                  ? 'bg-primary w-6'
                  : i < ['phone', 'otp', 'details'].indexOf(regStep)
                    ? 'bg-primary/40 w-4'
                    : 'bg-muted w-4'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      {/* ─── Step 1: Phone ───────────────────────────────────── */}
      {regStep === 'phone' && (
        <div>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Введите номер телефона. Мы отправим код подтверждения через Telegram.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm font-semibold">Телефон *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+7 (000) (000) 00 00"
                value={phone}
                onChange={handlePhoneChange}
                onBlur={() => setPhoneTouched(true)}
                autoComplete="tel"
                className={`rounded-xl transition-all duration-200 ${
                  phoneError ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-primary/50'
                }`}
              />
              {phoneError && (
                <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                  {phoneError}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              className="w-full rounded-xl h-11 text-base font-semibold"
              onClick={handleRequestOtp}
              disabled={isRequestingOtp}
            >
              {isRequestingOtp ? 'Запрос...' : 'Получить код в Telegram'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Уже есть аккаунт?{' '}
              <Link href="/login" className="text-primary hover:underline font-semibold">Войти</Link>
            </p>
          </CardFooter>
        </div>
      )}

      {/* ─── Step 2: OTP ─────────────────────────────────────── */}
      {regStep === 'otp' && (
        <div>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/60">
              <MessageCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Откройте Telegram-бот</p>
                {botUsername ? (
                  <p className="text-muted-foreground">
                    Найдите <span className="font-mono text-primary">@{botUsername}</span> и нажмите кнопку «Поделиться контактом» — вам придёт 6-значный код.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Найдите наш бот в Telegram и нажмите «Поделиться контактом» — вам придёт 6-значный код.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="otp" className="text-sm font-semibold">Код из Telegram</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="rounded-xl text-center text-xl tracking-widest font-mono focus-visible:ring-primary/50"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              className="w-full rounded-xl h-11 text-base font-semibold"
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp || otpCode.length !== 6}
            >
              {isVerifyingOtp ? 'Проверка...' : 'Подтвердить'}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setRegStep('phone'); setOtpCode(''); }}
            >
              Изменить номер телефона
            </Button>
          </CardFooter>
        </div>
      )}

      {/* ─── Step 3: Details ─────────────────────────────────── */}
      {regStep === 'details' && (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">

            {/* Имя */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-semibold">Имя *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => touch('name')}
                maxLength={30}
                autoComplete="name"
                className={`rounded-xl transition-all duration-200 ${
                  nameError ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-primary/50'
                }`}
              />
              {nameError && (
                <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                  {nameError}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold">Email *</Label>
              <Input
                id="email"
                type="text"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailDeliverable(null); }}
                onBlur={handleEmailBlur}
                autoComplete="email"
                className={`rounded-xl transition-all duration-200 ${
                  emailError || emailDeliverable === false
                    ? 'border-destructive focus-visible:ring-destructive'
                    : 'focus-visible:ring-primary/50'
                }`}
              />
              {emailError && (
                <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                  {emailError}
                </p>
              )}
              {!emailError && emailDeliverable === false && (
                <p className="text-xs text-destructive">
                  Email недоступен для получения писем. Проверьте адрес.
                </p>
              )}
              {isValidatingEmail && (
                <p className="text-xs text-muted-foreground">Проверка email...</p>
              )}
            </div>

            {/* Пароль */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold">Пароль *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Придумайте пароль"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onBlur={handlePasswordBlur}
                  autoComplete="new-password"
                  className={`rounded-xl transition-all duration-200 pr-10 ${
                    showRules && !passwordValid
                      ? 'border-destructive focus-visible:ring-destructive'
                      : 'focus-visible:ring-primary/50'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {showRules && (
                <ul className="mt-1.5 space-y-1">
                  {passwordRules.map((rule) => {
                    const fading = fadingIds.includes(rule.id);
                    if (rule.passed && !fading) return null;
                    return (
                      <li
                        key={rule.id}
                        className={`text-xs flex items-center gap-1.5 transition-all duration-300 ${
                          fading ? 'text-green-600 opacity-0' : 'text-destructive'
                        }`}
                      >
                        <span className="text-[10px]">{fading ? '✓' : '✗'}</span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full rounded-xl h-11 text-base font-semibold transition-all duration-200 active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Уже есть аккаунт?{' '}
              <Link href="/login" className="text-primary hover:underline font-semibold transition-colors">
                Войти
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
