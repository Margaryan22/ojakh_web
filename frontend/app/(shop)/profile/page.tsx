'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth.store';
import { FadeIn } from '@/components/motion/fade-in';
import { Skeleton } from '@/components/ui/skeleton';
import { AxiosError } from 'axios';
import api from '@/lib/api';
import type { User } from '@/types';
import {
  formatPhone,
  extractPhoneDigits,
  validateName,
  validatePhone,
  PHONE_DIGITS_COUNT,
} from '@/lib/validation';

type PhoneStep = 'idle' | 'enter-phone' | 'enter-code';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name ?? '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  const [phoneStep, setPhoneStep] = useState<PhoneStep>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [code, setCode] = useState('');
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (phoneStep !== 'enter-code') return;
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [phoneStep]);

  useEffect(() => {
    return () => {
      // Clear sensitive state on unmount (React 19 strict-mode safe)
      setNewPhone('');
      setCode('');
      setResendAvailableAt(null);
    };
  }, []);

  if (!isInitialized) {
    return (
      <div className='max-w-lg mx-auto space-y-6'>
        <Skeleton className='h-8 w-32' />
        <Skeleton className='h-64 w-full rounded-xl' />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const nameError = validateName(name, nameTouched);
  const isNameValid = !validateName(name, true);
  const nameChanged = name.trim() !== (user.name ?? '').trim();

  const phoneError = validatePhone(newPhone, phoneTouched);
  const isPhoneValid = extractPhoneDigits(newPhone).length === PHONE_DIGITS_COUNT;

  const formattedCurrentPhone = user.phone
    ? formatPhone(extractPhoneDigits(user.phone))
    : null;

  const resendCountdown = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - nowTs) / 1000))
    : 0;
  const canResend = resendCountdown <= 0;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const withoutPrefix = raw.startsWith('+7') ? raw.slice(2) : raw;
    const digits = withoutPrefix.replace(/\D/g, '').slice(0, PHONE_DIGITS_COUNT);
    setNewPhone(digits ? formatPhone(digits) : '');
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (!isNameValid || !nameChanged) return;
    setIsSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
      toast.success('Имя обновлено');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка обновления');
      } else {
        toast.error('Ошибка обновления');
      }
    } finally {
      setIsSavingName(false);
    }
  };

  const handleRequestCode = async () => {
    setPhoneTouched(true);
    if (!isPhoneValid) return;

    const digits = extractPhoneDigits(newPhone);
    const normalized = `+7${digits}`;

    if (normalized === user.phone) {
      toast.error('Этот номер уже подтверждён на вашем аккаунте');
      return;
    }

    setIsRequestingCode(true);
    try {
      const { data } = await api.post('/users/me/phone/request-code', {
        phone: normalized,
      });
      setResendAvailableAt(new Date(data.resendAvailableAt).getTime());
      setCode('');
      setPhoneStep('enter-code');
      toast.success('Код отправлен в Telegram');
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const message =
          error.response?.data?.message ??
          (status === 429 ? 'Слишком частые запросы, попробуйте позже' : 'Не удалось отправить код');
        toast.error(Array.isArray(message) ? message[0] : message);
      } else {
        toast.error('Не удалось отправить код');
      }
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleConfirm = async () => {
    if (code.length !== 6) {
      toast.error('Введите 6 цифр кода');
      return;
    }
    setIsConfirming(true);
    try {
      const { data } = await api.post<User>('/users/me/phone/confirm', { code });
      setUser(data);
      toast.success('Номер подтверждён');
      setPhoneStep('idle');
      setNewPhone('');
      setCode('');
      setResendAvailableAt(null);
    } catch (error) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message ?? 'Не удалось подтвердить номер';
        toast.error(Array.isArray(message) ? message[0] : message);
      } else {
        toast.error('Не удалось подтвердить номер');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleStartPhoneChange = () => {
    setNewPhone('');
    setCode('');
    setPhoneTouched(false);
    setResendAvailableAt(null);
    setPhoneStep('enter-phone');
  };

  const handleCancelPhoneChange = () => {
    setPhoneStep('idle');
    setNewPhone('');
    setCode('');
    setPhoneTouched(false);
    setResendAvailableAt(null);
  };

  const handleBackToPhoneEntry = () => {
    setCode('');
    setResendAvailableAt(null);
    setPhoneStep('enter-phone');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <FadeIn>
      <div className='max-w-lg mx-auto space-y-6'>
        <h1 className='text-2xl font-bold'>Профиль</h1>

        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Личные данные</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveName} className='space-y-4'>
              <div className='space-y-1.5'>
                <Label>Email</Label>
                <Input value={user.email} disabled />
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='name'>Имя</Label>
                <Input
                  id='name'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  maxLength={30}
                  placeholder='Ваше имя'
                  className={nameError ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {nameError && <p className='text-xs text-destructive'>{nameError}</p>}
              </div>

              <Button type='submit' disabled={isSavingName || !nameChanged}>
                {isSavingName ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <Phone className='h-4 w-4' /> Номер телефона
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {phoneStep === 'idle' && (
              <>
                {formattedCurrentPhone ? (
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium tabular-nums'>{formattedCurrentPhone}</span>
                      <span className='inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400'>
                        <ShieldCheck className='h-3.5 w-3.5' /> подтверждён
                      </span>
                    </div>
                    <Button variant='outline' onClick={handleStartPhoneChange}>
                      Изменить
                    </Button>
                  </div>
                ) : (
                  <div className='flex items-center justify-between gap-3'>
                    <p className='text-sm text-muted-foreground'>Не указан</p>
                    <Button onClick={handleStartPhoneChange}>Добавить номер</Button>
                  </div>
                )}
                <p className='text-xs text-muted-foreground'>
                  Номер используется курьером для связи и подтверждается кодом из Telegram.
                </p>
              </>
            )}

            {phoneStep === 'enter-phone' && (
              <div className='space-y-3'>
                <div className='space-y-1.5'>
                  <Label htmlFor='new-phone'>Новый номер</Label>
                  <Input
                    id='new-phone'
                    type='tel'
                    value={newPhone}
                    onChange={handlePhoneChange}
                    onBlur={() => setPhoneTouched(true)}
                    placeholder='+7 (000) (000) 00 00'
                    autoFocus
                    className={phoneError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {phoneError && <p className='text-xs text-destructive'>{phoneError}</p>}
                  <p className='text-xs text-muted-foreground'>
                    Мы отправим код подтверждения в приложение Telegram на указанный номер.
                  </p>
                </div>
                <div className='flex gap-2'>
                  <Button onClick={handleRequestCode} disabled={isRequestingCode || !isPhoneValid}>
                    {isRequestingCode ? 'Отправка...' : 'Получить код в Telegram'}
                  </Button>
                  <Button variant='ghost' onClick={handleCancelPhoneChange}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}

            {phoneStep === 'enter-code' && (
              <div className='space-y-3'>
                <p className='text-sm text-muted-foreground'>
                  Код отправлен в Telegram на номер{' '}
                  <span className='font-medium text-foreground'>{newPhone}</span>.
                </p>
                <div className='space-y-1.5'>
                  <Label htmlFor='code'>Код из Telegram</Label>
                  <Input
                    id='code'
                    inputMode='numeric'
                    pattern='\d{6}'
                    maxLength={6}
                    value={code}
                    onChange={handleCodeChange}
                    placeholder='6 цифр'
                    autoFocus
                    className='tracking-widest text-center text-lg tabular-nums'
                  />
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button onClick={handleConfirm} disabled={isConfirming || code.length !== 6}>
                    {isConfirming ? 'Подтверждение...' : 'Подтвердить'}
                  </Button>
                  <Button
                    variant='outline'
                    onClick={handleRequestCode}
                    disabled={!canResend || isRequestingCode}
                  >
                    {canResend
                      ? 'Отправить снова'
                      : `Отправить снова (${resendCountdown})`}
                  </Button>
                  <Button variant='ghost' onClick={handleBackToPhoneEntry}>
                    Изменить номер
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Link href='/profile/addresses' className='block'>
          <Button variant='outline' className='w-full gap-2 justify-start'>
            <MapPin className='h-4 w-4' />
            Мои адреса доставки
          </Button>
        </Link>

        <Separator />

        <Button variant='outline' onClick={handleLogout} className='w-full'>
          Выйти из аккаунта
        </Button>
      </div>
    </FadeIn>
  );
}
