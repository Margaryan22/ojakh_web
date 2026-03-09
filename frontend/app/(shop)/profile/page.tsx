'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth.store';
import { Skeleton } from '@/components/ui/skeleton';
import { AxiosError } from 'axios';
import api from '@/lib/api';
import {
  formatPhone,
  extractPhoneDigits,
  validateName,
  validatePhone,
  PHONE_DIGITS_COUNT,
} from '@/lib/validation';

type PhoneStep = 'view' | 'request' | 'verify';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ? formatPhone(extractPhoneDigits(user.phone)) : '');
  const [isSaving, setIsSaving] = useState(false);

  const [phoneStep, setPhoneStep] = useState<PhoneStep>('view');
  const [otpCode, setOtpCode] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');

  const [touched, setTouched] = useState({ name: false, phone: false });
  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  if (!isInitialized) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const nameError = validateName(name, touched.name);
  const phoneError = validatePhone(phone, touched.phone);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const withoutPrefix = raw.startsWith('+7') ? raw.slice(2) : raw;
    const digits = withoutPrefix.replace(/\D/g, '').slice(0, PHONE_DIGITS_COUNT);
    setPhone(digits ? formatPhone(digits) : '');
  };

  const isFormValid = !validateName(name, true) && !validatePhone(phone, true);

  const currentPhoneNormalized = user.phone ?? '';
  const newPhoneNormalized = (() => {
    const digits = extractPhoneDigits(phone);
    return digits ? `+7${digits}` : '';
  })();
  const phoneChanged = newPhoneNormalized && newPhoneNormalized !== currentPhoneNormalized;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true });
    if (!isFormValid) return;

    if (phoneChanged) {
      // Phone changed — start OTP flow
      setIsSaving(true);
      try {
        await api.post('/auth/request-otp', { phone: newPhoneNormalized });
        setPendingPhone(newPhoneNormalized);
        setPhoneStep('request');
        toast.success('Код отправлен. Откройте Telegram-бот и поделитесь контактом.');
      } catch (error) {
        if (error instanceof AxiosError) {
          toast.error(error.response?.data?.message ?? 'Ошибка запроса кода');
        } else {
          toast.error('Ошибка запроса кода');
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      toast.success('Профиль обновлён');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка обновления');
      } else {
        toast.error('Ошибка обновления');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/auth/verify-otp', { phone: pendingPhone, code: otpCode });
      setPhoneStep('verify');
      // Now update phone in backend
      await api.patch('/users/me/phone', { phone: pendingPhone });
      await updateProfile({ name: name.trim() });
      toast.success('Номер телефона обновлён');
      setPhoneStep('view');
      setOtpCode('');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка верификации');
      } else {
        toast.error('Ошибка верификации');
      }
      setPhoneStep('request');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelPhoneChange = () => {
    setPhoneStep('view');
    setOtpCode('');
    setPendingPhone('');
    setPhone(user.phone ? formatPhone(extractPhoneDigits(user.phone)) : '');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Профиль</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Личные данные</CardTitle>
        </CardHeader>
        <CardContent>
          {phoneStep === 'view' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user.email} disabled />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => touch('name')}
                  maxLength={30}
                  placeholder="Ваше имя"
                  className={nameError ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {nameError && (
                  <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                    {nameError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Телефон <span className="text-muted-foreground font-normal text-xs">(необязательно)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={() => touch('phone')}
                  placeholder="+7 (000) (000) 00 00"
                  className={phoneError ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {phoneError && (
                  <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                    {phoneError}
                  </p>
                )}
                {phoneChanged && (
                  <p className="text-xs text-muted-foreground">
                    Для смены номера потребуется подтверждение через Telegram-бот.
                  </p>
                )}
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Откройте Telegram-бот и поделитесь контактом с номером{' '}
                <span className="font-medium text-foreground">{pendingPhone}</span>.
                Бот пришлёт 6-значный код.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="otp">Код подтверждения</Label>
                <Input
                  id="otp"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  className="text-center tracking-widest text-lg"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleCancelPhoneChange}>
                  Отмена
                </Button>
                <Button type="submit" disabled={isSaving || otpCode.length !== 6}>
                  {isSaving ? 'Проверка...' : 'Подтвердить'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Button variant="outline" onClick={handleLogout} className="w-full">
        Выйти из аккаунта
      </Button>
    </div>
  );
}
