'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, formatDate } from '@/lib/format';
import { STATUS_LABELS, STATUS_COLORS, YANDEX_CLAIM_STATUS_LABELS } from '@/lib/constants';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import { OrderChat } from '@/components/order-chat';
import type { AdminOrder, OrderStatus, AdminUnreadSummary } from '@/types';
import { AxiosError } from 'axios';

const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'paid', label: 'Оплачены' },
  { value: 'preparing', label: 'Готовятся' },
  { value: 'ready', label: 'Готовы' },
  { value: 'delivering', label: 'В доставке' },
  { value: 'completed', label: 'Завершены' },
  { value: 'cancelled', label: 'Отменены' },
];

const PAGE_SIZE = 50;

interface AdminOrdersResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  limit: number;
}

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openChatOrderId, setOpenChatOrderId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Поиск и фильтры — серверные (работают по всей базе, а не по странице).
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<AdminOrdersResponse>({
    queryKey: ['admin-orders', statusFilter, debouncedSearch, page],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await api.get('/admin/orders', { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Политику обновления (SSE + fallback-поллинг) держит admin/layout.tsx,
  // у которого тот же queryKey — здесь просто читаем общий кэш.
  const { data: unreadSummary } = useQuery<AdminUnreadSummary>({
    queryKey: ['admin-unread-summary'],
    queryFn: async () => {
      const { data } = await api.get('/admin/messages/unread-summary');
      return data;
    },
    refetchIntervalInBackground: false,
  });

  const markReadyMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/ready`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ отмечен как готовый');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  const startCookingMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/start-cooking`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ начала готовить');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ отменён');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ завершён');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const useStagger = orders.length <= 30;
  const ListWrapper: React.ElementType = useStagger ? StaggerContainer : 'div';
  const ItemWrapper: React.ElementType = useStagger ? StaggerItem : 'div';
  const listProps = useStagger ? { immediate: true } : {};

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-bold">Заказы</h1>
      </FadeIn>

      <Input
        placeholder="Поиск по № заказа, имени, телефону или email клиента"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Tabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
      >
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {statusFilters.map((f) => (
            <TabsTrigger
              key={f.value}
              value={f.value}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 text-xs"
            >
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {orders.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Нет заказов</p>
      ) : (
        <ListWrapper className="space-y-3" {...listProps}>
          {orders.map((order) => (
            <ItemWrapper key={order.id}>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">#{order.orderNumber ?? order.id}</span>
                      <Badge className={STATUS_COLORS[order.status as OrderStatus]}>
                        {STATUS_LABELS[order.status as OrderStatus]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.user?.name ?? `#${order.userId}`}
                      {order.user?.phone ? ` · ${order.user.phone}` : ''}
                      {' · '}{formatDate(order.deliveryDate)}
                      {order.deliveryTime ? ` ${order.deliveryTime}` : ''}
                      {' · '}{order.isPickup ? 'Самовывоз' : 'Доставка'}
                    </p>
                  </div>
                  <span className="font-bold">{formatPrice(order.total)}</span>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  {order.items.map((item, idx) => (
                    <span key={idx}>
                      {item.name}
                      {item.flavor ? ` (${item.flavor})` : ''}
                      {' '}&times;{item.quantity}
                      {idx < order.items.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>

                {order.address && (
                  <p className="text-xs text-muted-foreground">
                    Адрес: {order.address}
                  </p>
                )}

                {((order.payments?.length ?? 0) > 0 || order.yandexClaimStatus) && (
                  <div className="flex gap-2 flex-wrap text-xs">
                    {(order.payments ?? []).map((p) => (
                      <Badge key={p.id} variant="outline">
                        {p.kind === 'doplata' ? 'Доплата' : 'Оплата'}
                        {' · '}{p.provider === 'yookassa' ? 'ЮKassa' : 'реквизиты'}
                        {' · '}
                        {p.status === 'succeeded'
                          ? 'оплачен'
                          : p.status === 'canceled'
                            ? 'отменён'
                            : 'ожидает'}
                      </Badge>
                    ))}
                    {order.yandexClaimStatus && (
                      <Badge variant="outline">
                        Яндекс: {YANDEX_CLAIM_STATUS_LABELS[order.yandexClaimStatus] ?? order.yandexClaimStatus}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={openChatOrderId === order.id ? 'default' : 'outline'}
                    onClick={() =>
                      setOpenChatOrderId((cur) =>
                        cur === order.id ? null : order.id,
                      )
                    }
                    className="gap-1.5 relative"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Чат
                    {unreadSummary?.byOrder?.[order.id] ? (
                      <Badge
                        variant="destructive"
                        className="ml-1 h-4 min-w-4 px-1 text-[10px]"
                      >
                        {unreadSummary.byOrder[order.id]}
                      </Badge>
                    ) : null}
                  </Button>
                  {order.status === 'paid' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startCookingMutation.mutate(order.id)}
                      disabled={startCookingMutation.isPending}
                    >
                      Начала готовить
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button
                      size="sm"
                      onClick={() => markReadyMutation.mutate(order.id)}
                      disabled={markReadyMutation.isPending}
                    >
                      Отметить готовым
                    </Button>
                  )}
                  {order.status === 'ready' && order.isPickup && (
                    <Button
                      size="sm"
                      onClick={() => completeMutation.mutate(order.id)}
                      disabled={completeMutation.isPending}
                    >
                      Выдан клиенту
                    </Button>
                  )}
                  {order.status === 'delivering' && (
                    <Button
                      size="sm"
                      onClick={() => completeMutation.mutate(order.id)}
                      disabled={completeMutation.isPending}
                    >
                      Доставлен
                    </Button>
                  )}
                  {order.status !== 'cancelled' && order.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelMutation.mutate(order.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Отменить
                    </Button>
                  )}
                </div>

                {openChatOrderId === order.id && (
                  <div className="pt-2">
                    <OrderChat orderId={order.id} role="admin" />
                  </div>
                )}
              </CardContent>
            </Card>
            </ItemWrapper>
          ))}
        </ListWrapper>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {page} из {totalPages} · всего {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  );
}
