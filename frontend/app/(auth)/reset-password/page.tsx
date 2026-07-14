'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Eye, EyeOff, LinkIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn } from '@/components/motion/fade-in';
import { Y_HERO } from '@/components/motion/motion-presets';
import api from '@/lib/api';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { data: check, isLoading } = useQuery<{ valid: boolean; name?: string }>({
    queryKey: ['reset-token', token],
    queryFn: async () =>
      (await api.get(`/auth/reset-password/${encodeURIComponent(token)}`)).data,
    enabled: token.length > 0,
    retry: false,
  });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const passwordError =
    touched && password.length < MIN_PASSWORD_LENGTH
      ? `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`
      : null;
  const confirmError =
    touched && confirm !== password ? 'Пароли не совпадают' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (password.length < MIN_PASSWORD_LENGTH || confirm !== password) return;

    setIsSaving(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Пароль обновлён — войдите с новым паролем');
      router.push('/login');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(
          error.response?.data?.message ?? 'Не удалось обновить пароль',
        );
      } else {
        toast.error('Не удалось обновить пароль');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (token && isLoading) {
    return (
      <Card className="shadow-lg border-border/60 rounded-2xl">
        <CardContent className="py-8 space-y-3">
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!token || check?.valid === false) {
    return (
      <FadeIn y={Y_HERO}>
        <Card className="shadow-lg border-border/60 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-center text-2xl"
              style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}
            >
              Ссылка недействительна
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <LinkIcon className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Ссылка для сброса пароля устарела или уже была использована.
              Запросите новую — это займёт минуту.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center gap-4">
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Запросить новую ссылку
            </Link>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Ко входу
            </Link>
          </CardFooter>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn y={Y_HERO}>
      <Card className="shadow-lg border-border/60 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle
            className="text-center text-2xl"
            style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}
          >
            Новый пароль
          </CardTitle>
          {check?.name && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              {check.name}, придумайте новый пароль для входа
            </p>
          )}
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold">
                Новый пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={`Минимум ${MIN_PASSWORD_LENGTH} символов`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`rounded-xl pr-10 ${
                    passwordError
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-destructive">{passwordError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm font-semibold">
                Повторите пароль
              </Label>
              <Input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ещё раз"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={`rounded-xl ${
                  confirmError
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
              />
              {confirmError && (
                <p className="text-xs text-destructive">{confirmError}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="pt-2">
            <Button
              type="submit"
              className="w-full rounded-xl h-11 text-base font-semibold"
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить пароль'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FadeIn>
  );
}
