'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';
import { AxiosError } from 'axios';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const emailError = touched.email && !email
    ? 'Email обязателен'
    : touched.email && email && !EMAIL_REGEX.test(email)
    ? 'Введите корректный email'
    : null;

  const passwordError = touched.password && !password ? 'Пароль обязателен' : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email || !password || !EMAIL_REGEX.test(email)) return;

    try {
      await login(email, password);
      toast.success('Вы вошли в систему');
      router.push('/catalog');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка входа');
      } else {
        toast.error('Ошибка входа');
      }
    }
  };

  return (
    <Card className="shadow-lg border-border/60 rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-center text-2xl" style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}>
          Вход
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">

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

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-semibold">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => touch('password')}
                autoComplete="current-password"
                className={`rounded-xl transition-all duration-200 pr-10 ${
                  passwordError ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-primary/50'
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
            {passwordError && (
              <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {passwordError}
              </p>
            )}
          </div>

        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            className="w-full rounded-xl h-11 text-base font-semibold transition-all duration-200 active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </Button>
          <SocialLoginButtons />
          <p className="text-sm text-muted-foreground text-center">
            Нет аккаунта?{' '}
            <Link href="/register" className="text-primary hover:underline font-semibold transition-colors">
              Зарегистрироваться
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
