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
import { AxiosError } from 'axios';
import {
  formatPhone,
  extractPhoneDigits,
  validateName,
  validatePhone,
  PHONE_DIGITS_COUNT,
} from '@/lib/validation';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ? formatPhone(extractPhoneDigits(user.phone)) : '');
  const [isSaving, setIsSaving] = useState(false);

  const [touched, setTouched] = useState({ name: false, phone: false });
  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true });
    if (!isFormValid) return;

    setIsSaving(true);
    try {
      const phoneDigits = extractPhoneDigits(phone);
      await updateProfile({
        name: name.trim(),
        phone: phoneDigits ? `+7${phoneDigits}` : undefined,
      });
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
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Button variant="outline" onClick={handleLogout} className="w-full">
        Выйти из аккаунта
      </Button>
    </div>
  );
}
