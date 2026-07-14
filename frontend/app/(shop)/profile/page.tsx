'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth.store';
import { FadeIn } from '@/components/motion/fade-in';
import { ChangePasswordCard } from '@/components/profile/change-password-card';
import { PushNotifications } from '@/components/push-notifications';
import { Skeleton } from '@/components/ui/skeleton';
import { AxiosError } from 'axios';
import { validateName } from '@/lib/validation';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState(user?.name ?? '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

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

        <ChangePasswordCard />

        <Link href='/profile/addresses' className='block'>
          <Button variant='outline' className='w-full gap-2 justify-start'>
            <MapPin className='h-4 w-4' />
            Мои адреса доставки
          </Button>
        </Link>

        <PushNotifications />

        <Separator />

        <Button variant='outline' onClick={handleLogout} className='w-full'>
          Выйти из аккаунта
        </Button>
      </div>
    </FadeIn>
  );
}
