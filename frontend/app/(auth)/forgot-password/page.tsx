'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { FadeIn } from '@/components/motion/fade-in';
import { Y_HERO } from '@/components/motion/motion-presets';
import api from '@/lib/api';
import {
  EMAIL_REGEX,
  formatPhone,
  extractPhoneDigits,
  PHONE_DIGITS_COUNT,
} from '@/lib/validation';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const emailError =
    touched && !EMAIL_REGEX.test(email) ? 'Введите корректный email' : null;
  const phoneDigits = extractPhoneDigits(phone);
  const phoneError =
    touched && phoneDigits.length !== PHONE_DIGITS_COUNT
      ? 'Введите номер полностью — по нему мы подтвердим, что аккаунт ваш'
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL_REGEX.test(email) || phoneDigits.length !== PHONE_DIGITS_COUNT)
      return;

    setIsSending(true);
    try {
      const lines = [
        'Запрос сброса пароля.',
        `Email аккаунта: ${email.trim()}`,
        `Телефон для связи: +7${phoneDigits}`,
      ];
      if (comment.trim()) lines.push(`Комментарий: ${comment.trim()}`);
      await api.post('/feedback', { kind: 'question', text: lines.join('\n') });
      setSent(true);
    } catch {
      toast.error('Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <FadeIn y={Y_HERO}>
        <Card className="shadow-lg border-border/60 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-center text-2xl"
              style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}
            >
              Заявка отправлена
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              Мы получили ваш запрос. Администратор проверит данные и отправит
              вам ссылку для установки нового пароля в WhatsApp, Telegram или
              SMS на указанный номер. Обычно это занимает не больше пары часов
              в рабочее время.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href="/login" className="text-sm text-primary hover:underline">
              Вернуться ко входу
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
            Восстановление пароля
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Если вы регистрировались через Google, Яндекс или Apple — просто{' '}
            <Link href="/login" className="text-primary hover:underline">
              войдите через соцсеть
            </Link>
            , пароль не нужен.
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Иначе оставьте заявку: администратор сверит данные и пришлёт вам
              одноразовую ссылку для установки нового пароля в мессенджер или
              SMS.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email аккаунта
              </Label>
              <Input
                id="email"
                type="text"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`rounded-xl ${
                  emailError
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
              />
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm font-semibold">
                Телефон для связи
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+7 (900) (123) 45 67"
                value={phone}
                onChange={(e) =>
                  setPhone(formatPhone(extractPhoneDigits(e.target.value)))
                }
                autoComplete="tel"
                className={`rounded-xl ${
                  phoneError
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
              />
              {phoneError && (
                <p className="text-xs text-destructive">{phoneError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comment" className="text-sm font-semibold">
                Комментарий{' '}
                <span className="font-normal text-muted-foreground">
                  (необязательно)
                </span>
              </Label>
              <Textarea
                id="comment"
                rows={2}
                maxLength={500}
                placeholder="Например: удобнее написать в Telegram @username"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full rounded-xl h-11 text-base font-semibold"
              disabled={isSending}
            >
              {isSending ? 'Отправка...' : 'Отправить заявку'}
            </Button>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Вернуться ко входу
            </Link>
          </CardFooter>
        </form>
      </Card>
    </FadeIn>
  );
}
