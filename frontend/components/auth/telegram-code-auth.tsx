'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

interface Props {
  onSuccess: () => void;
}

export function TelegramCodeAuth({ onSuccess }: Props) {
  const loginWithTgCode = useAuthStore((s) => s.loginWithTgCode);
  const [token, setToken] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const { data } = await api.post('/auth/tg-start');
      setToken(data.token);
      setDeepLink(data.deepLink);
      window.open(data.deepLink, '_blank');
    } catch {
      toast.error('Ошибка при запросе кода');
    } finally {
      setIsStarting(false);
    }
  };

  const handleVerify = async () => {
    if (!token || code.length !== 6) return;
    setIsVerifying(true);
    try {
      await loginWithTgCode(token, code);
      onSuccess();
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Неверный код');
      } else {
        toast.error('Ошибка подтверждения');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = async () => {
    setToken(null);
    setDeepLink(null);
    setCode('');
  };

  if (!token) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl h-11 gap-2 border-[#0088cc]/40 text-[#0088cc] hover:bg-[#0088cc]/5 hover:border-[#0088cc]"
        onClick={handleStart}
        disabled={isStarting}
      >
        <Send size={16} />
        {isStarting ? 'Запрос...' : 'Войти через Telegram'}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted/50 border border-border/60 p-3 text-sm space-y-2">
        <p className="font-medium">Telegram открыт — проверьте сообщения</p>
        <p className="text-muted-foreground">Бот прислал вам 6-значный код. Введите его ниже.</p>
        {deepLink && (
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0088cc] underline text-xs"
          >
            Открыть Telegram снова
          </a>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tg-code" className="text-sm font-semibold">Код из Telegram</Label>
        <Input
          id="tg-code"
          type="text"
          inputMode="numeric"
          placeholder="123456"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="rounded-xl text-center text-xl tracking-widest font-mono focus-visible:ring-primary/50"
          autoFocus
        />
      </div>

      <Button
        type="button"
        className="w-full rounded-xl h-11 text-base font-semibold"
        onClick={handleVerify}
        disabled={isVerifying || code.length !== 6}
      >
        {isVerifying ? 'Проверка...' : 'Войти'}
      </Button>

      <button
        type="button"
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        onClick={handleReset}
      >
        Запросить новый код
      </button>
    </div>
  );
}
