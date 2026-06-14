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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface StoreSettings {
  minOrderKopecks: number;
  freeDeliveryThresholdKopecks: number;
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
    </div>
  );
}
