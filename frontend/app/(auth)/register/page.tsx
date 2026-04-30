'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { TelegramCodeAuth } from '@/components/auth/telegram-code-auth';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';

export default function RegisterPage() {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const handleSuccess = () => {
    toast.success('Добро пожаловать!');
    router.push('/catalog');
  };

  return (
    <Card className="shadow-lg border-border/60 rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-center text-2xl" style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}>
          Регистрация
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Войдите через Telegram — аккаунт создастся автоматически
        </p>
        <TelegramCodeAuth onSuccess={handleSuccess} />
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pt-0">
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
    </Card>
  );
}
