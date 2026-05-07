'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { AxiosError } from 'axios';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';
import {
  EMAIL_REGEX,
  formatPhone,
  extractPhoneDigits,
  validateName,
  validatePhone,
  PHONE_DIGITS_COUNT,
} from '@/lib/validation';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    phone: false,
  });

  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const nameError = validateName(name, touched.name);
  const emailError = touched.email && !email
    ? 'Email обязателен'
    : touched.email && !EMAIL_REGEX.test(email)
      ? 'Введите корректный email'
      : null;
  const passwordError = touched.password && !password
    ? 'Пароль обязателен'
    : touched.password && password.length < 8
      ? 'Минимум 8 символов'
      : null;
  const phoneError = validatePhone(phone, touched.phone);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const withoutPrefix = raw.startsWith('+7') ? raw.slice(2) : raw;
    const digits = withoutPrefix.replace(/\D/g, '').slice(0, PHONE_DIGITS_COUNT);
    setPhone(digits ? formatPhone(digits) : '');
  };

  const isFormValid =
    !validateName(name, true) &&
    EMAIL_REGEX.test(email) &&
    password.length >= 8 &&
    !validatePhone(phone, true);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, phone: true });
    if (!isFormValid) return;

    const phoneDigits = extractPhoneDigits(phone);
    const phoneNormalized = phoneDigits ? `+7${phoneDigits}` : undefined;

    try {
      await register({
        email: email.trim(),
        name: name.trim(),
        password,
        phone: phoneNormalized,
      });
      toast.success('Добро пожаловать!');
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
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-semibold">Имя</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => touch('name')}
              maxLength={30}
              placeholder="Ваше имя"
              autoComplete="name"
              className={`rounded-xl ${nameError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
            <Input
              id="email"
              type="text"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => touch('email')}
              autoComplete="email"
              className={`rounded-xl ${emailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-semibold">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Минимум 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => touch('password')}
                autoComplete="new-password"
                className={`rounded-xl pr-10 ${passwordError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
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
            {passwordError && (
              <p className="text-xs text-destructive">{passwordError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-semibold">
              Телефон <span className="text-muted-foreground font-normal text-xs">(необязательно)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={() => touch('phone')}
              placeholder="+7 (000) (000) 00 00"
              autoComplete="tel"
              className={`rounded-xl ${phoneError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {phoneError && (
              <p className="text-xs text-destructive">{phoneError}</p>
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

          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">или</span>
            </div>
          </div>
          <SocialLoginButtons />
          <p className="text-sm text-muted-foreground text-center">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">Войти</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
