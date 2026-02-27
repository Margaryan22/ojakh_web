'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { AxiosError } from 'axios';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = [
  { id: 'length', label: 'Минимум 8 символов',                test: (p: string) => p.length >= 8 },
  { id: 'upper',  label: 'Хотя бы одна заглавная буква (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',  label: 'Хотя бы одна строчная буква (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit',  label: 'Хотя бы одна цифра (0-9)',           test: (p: string) => /[0-9]/.test(p) },
];

// Принимает только 10 пользовательских цифр (без кода страны)
function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 3) return `+7 (${d}`;
  if (d.length <= 6) return `+7 (${d.slice(0, 3)}) (${d.slice(3)}`;
  if (d.length <= 8) return `+7 (${d.slice(0, 3)}) (${d.slice(3, 6)}) ${d.slice(6)}`;
  return `+7 (${d.slice(0, 3)}) (${d.slice(3, 6)}) ${d.slice(6, 8)} ${d.slice(8)}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
  });

  const [showPassword, setShowPassword] = useState(false);

  // Пароль: debounce 1.5с перед показом ошибок
  const [showRules, setShowRules] = useState(false);
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPassedRef = useRef<string[]>([]);

  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  // ─── Email ───────────────────────────────────────────────
  const emailError = touched.email && !email
    ? 'Email обязателен'
    : touched.email && email && !EMAIL_REGEX.test(email)
    ? 'Введите корректный email'
    : null;

  // ─── Имя ────────────────────────────────────────────────
  const nameError = touched.name && !name ? 'Имя обязательно' : null;

  // ─── Телефон ─────────────────────────────────────────────
  // Убираем +7 и ведущую 7 из строки, берём только пользовательские цифры
  const phoneDigits = phone.replace(/\D/g, '').slice(1); // slice(1) — убираем '7' из +7
  const phoneError = touched.phone && phone && phoneDigits.length !== 10
    ? 'Введите номер полностью'
    : null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Снимаем +7 чтобы '7' не попала в пользовательские цифры
    const withoutPrefix = raw.startsWith('+7') ? raw.slice(2) : raw;
    const digits = withoutPrefix.replace(/\D/g, '').slice(0, 10);
    setPhone(formatPhone(digits));
  };

  // ─── Пароль ──────────────────────────────────────────────
  const passwordRules = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));
  const passwordValid = passwordRules.every((r) => r.passed);

  const handlePasswordChange = (newVal: string) => {
    setPassword(newVal);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!newVal) {
      setShowRules(false);
      prevPassedRef.current = [];
      return;
    }

    if (showRules) {
      // Уже показываем — определяем только что выполненные правила
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
      // Ещё не показываем — запускаем таймер 1.5с
      timerRef.current = setTimeout(() => {
        prevPassedRef.current = PASSWORD_RULES.filter((r) => r.test(newVal)).map((r) => r.id);
        setShowRules(true);
      }, 1500);
    }
  };

  const handlePasswordBlur = () => {
    // При потере фокуса — показываем сразу (не ждём таймер)
    if (timerRef.current) clearTimeout(timerRef.current);
    if (password && !showRules) {
      prevPassedRef.current = PASSWORD_RULES.filter((r) => r.test(password)).map((r) => r.id);
      setShowRules(true);
    }
  };

  // ─── Форма ───────────────────────────────────────────────
  const isFormValid =
    !!name &&
    EMAIL_REGEX.test(email) &&
    passwordValid &&
    (phone === '' || phoneDigits.length === 10);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true });
    if (password && !showRules) {
      prevPassedRef.current = PASSWORD_RULES.filter((r) => r.test(password)).map((r) => r.id);
      setShowRules(true);
    }
    if (!isFormValid) return;

    try {
      await register({
        name,
        email,
        password,
        phone: phoneDigits ? `+7${phoneDigits}` : undefined,
      });
      toast.success('Регистрация успешна');
      router.push('/catalog');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка регистрации');
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
      </CardHeader>
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
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => touch('email')}
              autoComplete="email"
              className={`rounded-xl transition-all duration-200 ${
                emailError ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-primary/50'
              }`}
            />
            {emailError && (
              <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {emailError}
              </p>
            )}
          </div>

          {/* Телефон */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-semibold">
              Телефон <span className="text-muted-foreground font-normal">(необязательно)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+7 (000) (000) 00 00"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={() => touch('phone')}
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
    </Card>
  );
}
