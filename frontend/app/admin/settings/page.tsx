'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import api from '@/lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Copy, KeyRound, Send, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { ADMIN_ROLE } from '@/lib/constants';
import { formatDateFull } from '@/lib/format';

interface StoreSettings {
  minOrderKopecks: number;
  freeDeliveryThresholdKopecks: number;
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: 'user' | 'admin';
  createdAt: string;
  ordersCount: number;
}

// Поля редактируются в рублях, на бэкенд уходят копейки.
const toRubles = (kopecks: number) => String(Math.round(kopecks) / 100);
const toKopecks = (rubles: string) => Math.round(parseFloat(rubles) * 100);

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<StoreSettings>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings');
      return data;
    },
  });

  const [minOrder, setMinOrder] = useState('');
  const [freeThreshold, setFreeThreshold] = useState('');

  // Заполняем поля, когда настройки загрузились.
  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренное заполнение формы данными с сервера после загрузки
      setMinOrder(toRubles(data.minOrderKopecks));
      setFreeThreshold(toRubles(data.freeDeliveryThresholdKopecks));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: StoreSettings) => {
      const { data } = await api.put('/admin/settings', payload);
      return data;
    },
    onSuccess: () => {
      // Сбрасываем кэш и на странице админки, и в корзине покупателя.
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast.success('Настройки сохранены');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось сохранить');
      } else {
        toast.error('Не удалось сохранить');
      }
    },
  });

  // ── Рассылка объявлений всем клиентам ─────────────────────────────────────
  const MAX_BROADCAST = 1000;
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const broadcastMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post('/admin/broadcast', { message });
      return data as { sent: number };
    },
    onSuccess: (res) => {
      toast.success(`Объявление отправлено: ${res.sent} клиент(ов)`);
      setBroadcastMsg('');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось отправить');
      } else {
        toast.error('Не удалось отправить');
      }
    },
  });

  const broadcastText = broadcastMsg.trim();
  const broadcastInvalid =
    broadcastText.length < 3 || broadcastText.length > MAX_BROADCAST;

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (broadcastInvalid) {
      toast.error('Сообщение должно быть от 3 до 1000 символов');
      return;
    }
    broadcastMutation.mutate(broadcastText);
  };

  // ── Управление пользователями ─────────────────────────────────────────────
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Пользователь, для которого открыто окно подтверждения удаления.
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  // Поиск по имени / email / телефону — серверный (по всей базе).
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearch.trim());
      setUsersPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const { data: usersData, isLoading: usersLoading } = useQuery<{
    users: AdminUser[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ['admin-users', debouncedUserSearch, usersPage],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(usersPage),
        limit: '50',
      };
      if (debouncedUserSearch) params.search = debouncedUserSearch;
      return (await api.get('/admin/users', { params })).data;
    },
    placeholderData: (prev) => prev,
  });
  const users = usersData?.users ?? [];
  const usersTotal = usersData?.total ?? 0;
  const usersTotalPages = Math.max(1, Math.ceil(usersTotal / 50));
  // Выданная ссылка сброса пароля (показывается в диалоге один раз).
  const [resetLink, setResetLink] = useState<{
    user: AdminUser;
    url: string;
    expiresAt: string;
  } | null>(null);

  const resetLinkMutation = useMutation({
    mutationFn: async (user: AdminUser) => {
      const { data } = await api.post(`/admin/users/${user.id}/password-reset`);
      return { user, url: data.url as string, expiresAt: data.expiresAt as string };
    },
    onSuccess: (data) => setResetLink(data),
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось создать ссылку');
      } else {
        toast.error('Не удалось создать ссылку');
      }
    },
  });

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.url);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать — выделите ссылку вручную');
    }
  };

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: 'user' | 'admin' }) => {
      await api.patch(`/admin/users/${id}/role`, { role });
    },
    onSuccess: (_data, { role }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        role === 'admin' ? 'Назначен администратором' : 'Права администратора сняты',
      );
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось изменить роль');
      } else {
        toast.error('Не удалось изменить роль');
      }
    },
  });

  // Поиск теперь серверный — список уже отфильтрован.
  const filteredUsers = users;

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Пользователь и все его данные удалены');
      setUserToDelete(null);
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось удалить');
      } else {
        toast.error('Не удалось удалить');
      }
    },
  });

  const minOrderKopecks = toKopecks(minOrder);
  const freeThresholdKopecks = toKopecks(freeThreshold);
  const invalid =
    !Number.isFinite(minOrderKopecks) ||
    minOrderKopecks < 0 ||
    !Number.isFinite(freeThresholdKopecks) ||
    freeThresholdKopecks < 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) {
      toast.error('Укажите корректные суммы (в рублях, не меньше 0)');
      return;
    }
    mutation.mutate({
      minOrderKopecks,
      freeDeliveryThresholdKopecks: freeThresholdKopecks,
    });
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1">Настройки магазина</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Суммы указываются в рублях.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Заказ и доставка</CardTitle>
          <CardDescription>
            Минимальная сумма заказа и порог бесплатной доставки.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="min-order">
                  Минимальная сумма заказа, ₽
                </Label>
                <Input
                  id="min-order"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Без учёта доставки. Заказ на меньшую сумму оформить нельзя.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="free-threshold">
                  Бесплатная доставка от, ₽
                </Label>
                <Input
                  id="free-threshold"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={freeThreshold}
                  onChange={(e) => setFreeThreshold(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  При сумме заказа от этого значения доставка бесплатна.
                </p>
              </div>

              <Button type="submit" disabled={mutation.isPending || invalid}>
                {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Рассылка клиентам</CardTitle>
          <CardDescription>
            Отправьте объявление всем клиентам сразу. Оно появится у них в
            колокольчике уведомлений и придёт push-сообщением.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBroadcast} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="broadcast">Текст объявления</Label>
              <Textarea
                id="broadcast"
                rows={4}
                maxLength={MAX_BROADCAST}
                placeholder="Например: Завтра работаем до 18:00. Успейте оформить заказ!"
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">
                {broadcastText.length} / {MAX_BROADCAST}
              </p>
            </div>

            <Button
              type="submit"
              disabled={broadcastMutation.isPending || broadcastInvalid}
            >
              <Send className="h-4 w-4 mr-2" />
              {broadcastMutation.isPending
                ? 'Отправка...'
                : 'Отправить всем клиентам'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>
            Назначайте администраторов и управляйте аккаунтами. Удаление
            необратимо: вместе с аккаунтом удаляются все его заказы, корзина,
            избранное, отзывы, адреса и уведомления.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Поиск по имени, email или телефону"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          {usersLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пользователей пока нет.
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Никто не найден по запросу «{userSearch.trim()}».
            </p>
          ) : (
            <div className="divide-y">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                const isAdmin = u.role === ADMIN_ROLE;
                return (
                  <div key={u.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{u.name}</span>
                        {isAdmin && <Badge variant="secondary">админ</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                        {u.phone && ` · ${u.phone}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.ordersCount} заказ(ов) · с{' '}
                        {formatDateFull(u.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf || roleMutation.isPending}
                      title={
                        isSelf
                          ? 'Нельзя менять собственную роль'
                          : isAdmin
                            ? 'Снять права администратора'
                            : 'Назначить администратором'
                      }
                      onClick={() =>
                        roleMutation.mutate({
                          id: u.id,
                          role: isAdmin ? 'user' : 'admin',
                        })
                      }
                    >
                      {isAdmin ? 'Снять админа' : 'Сделать админом'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={resetLinkMutation.isPending}
                      title="Ссылка для сброса пароля"
                      onClick={() => resetLinkMutation.mutate(u)}
                      aria-label="Ссылка для сброса пароля"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isSelf}
                      title={
                        isSelf
                          ? 'Нельзя удалить себя'
                          : 'Удалить пользователя'
                      }
                      onClick={() => setUserToDelete(u)}
                      aria-label="Удалить пользователя"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {usersTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={usersPage <= 1}
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {usersPage} из {usersTotalPages} · всего {usersTotal}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={usersPage >= usersTotalPages}
                onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
              >
                Вперёд
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить пользователя?</DialogTitle>
            <DialogDescription>
              {userToDelete && (
                <>
                  Аккаунт <span className="font-medium">{userToDelete.name}</span>{' '}
                  ({userToDelete.email}) будет удалён безвозвратно вместе со всеми{' '}
                  {userToDelete.ordersCount} заказами и остальными данными. Это
                  действие нельзя отменить.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Отмена</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteUserMutation.isPending}
              onClick={() =>
                userToDelete && deleteUserMutation.mutate(userToDelete.id)
              }
            >
              {deleteUserMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetLink}
        onOpenChange={(open) => !open && setResetLink(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ссылка для сброса пароля</DialogTitle>
            <DialogDescription>
              {resetLink && (
                <>
                  Отправьте её клиенту{' '}
                  <span className="font-medium">{resetLink.user.name}</span>
                  {resetLink.user.phone && ` (${resetLink.user.phone})`} в
                  WhatsApp, Telegram или SMS. Ссылка одноразовая и действует
                  24 часа; при повторной выдаче старая перестаёт работать.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {resetLink && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={resetLink.url}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copyResetLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Закрыть</Button>
            </DialogClose>
            <Button onClick={copyResetLink}>Скопировать ссылку</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
