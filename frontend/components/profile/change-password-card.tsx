'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Смена пароля из профиля. Для аккаунтов, созданных через соцсеть
 * (hasPassword = false), поле «текущий пароль» не показывается —
 * пароль задаётся впервые.
 */
export function ChangePasswordCard() {
  const queryClient = useQueryClient();

  const { data: me } = useQuery<{ hasPassword: boolean }>({
    queryKey: ['users-me'],
    queryFn: async () => (await api.get('/users/me')).data,
  });
  const hasPassword = me?.hasPassword ?? true;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentError =
    touched && hasPassword && !currentPassword
      ? 'Укажите текущий пароль'
      : null;
  const newError =
    touched && newPassword.length < MIN_PASSWORD_LENGTH
      ? `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`
      : null;
  const confirmError =
    touched && confirm !== newPassword ? 'Пароли не совпадают' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (
      (hasPassword && !currentPassword) ||
      newPassword.length < MIN_PASSWORD_LENGTH ||
      confirm !== newPassword
    )
      return;

    setIsSaving(true);
    try {
      await api.patch('/users/me/password', {
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
      });
      toast.success(hasPassword ? 'Пароль изменён' : 'Пароль установлен');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setTouched(false);
      queryClient.invalidateQueries({ queryKey: ['users-me'] });
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(
          error.response?.data?.message ?? 'Не удалось изменить пароль',
        );
      } else {
        toast.error('Не удалось изменить пароль');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {hasPassword ? 'Смена пароля' : 'Установить пароль'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasPassword && (
          <p className="text-sm text-muted-foreground mb-4">
            Вы входите через соцсеть. Задайте пароль, чтобы можно было входить
            и по email.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Текущий пароль</Label>
              <Input
                id="current-password"
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className={
                  currentError
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
              />
              {currentError && (
                <p className="text-xs text-destructive">{currentError}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Новый пароль</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={`Минимум ${MIN_PASSWORD_LENGTH} символов`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className={`pr-10 ${
                  newError
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
            {newError && <p className="text-xs text-destructive">{newError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Повторите новый пароль</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={
                confirmError
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
            />
            {confirmError && (
              <p className="text-xs text-destructive">{confirmError}</p>
            )}
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving
              ? 'Сохранение...'
              : hasPassword
                ? 'Изменить пароль'
                : 'Установить пароль'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
