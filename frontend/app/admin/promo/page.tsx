'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';

interface PromoCode {
  id: number;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderKopecks: number;
  maxUses: number | null;
  usedCount: number;
  perUserOnce: boolean;
  active: boolean;
}

export default function AdminPromoPage() {
  const queryClient = useQueryClient();

  const { data: codes = [], isLoading } = useQuery<PromoCode[]>({
    queryKey: ['admin-promo'],
    queryFn: async () => (await api.get('/admin/promo')).data,
  });

  // ── Форма создания ──
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [perUserOnce, setPerUserOnce] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-promo'] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        code: code.trim(),
        type,
        // percent → процент как есть; fixed → рубли в копейки
        value: type === 'percent' ? Number(value) : Math.round(Number(value) * 100),
        perUserOnce,
      };
      if (minOrder.trim()) payload.minOrderKopecks = Math.round(Number(minOrder) * 100);
      if (maxUses.trim()) payload.maxUses = Number(maxUses);
      await api.post('/admin/promo', payload);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Промокод создан');
      setCode('');
      setValue('');
      setMinOrder('');
      setMaxUses('');
      setPerUserOnce(false);
    },
    onError: (e) =>
      toast.error(
        e instanceof AxiosError ? e.response?.data?.message ?? 'Ошибка' : 'Ошибка',
      ),
  });

  const toggleMutation = useMutation({
    mutationFn: async (p: PromoCode) => {
      await api.put(`/admin/promo/${p.id}`, { active: !p.active });
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/promo/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Промокод удалён');
    },
  });

  const valueLabel = (p: PromoCode) =>
    p.type === 'percent' ? `${p.value}%` : formatPrice(p.value);

  const canCreate = code.trim() && value.trim() && Number(value) > 0;

  return (
    <div className='max-w-2xl space-y-6'>
      <div>
        <h1 className='text-2xl font-bold mb-1'>Промокоды</h1>
        <p className='text-sm text-muted-foreground'>
          Суммы указываются в рублях. Код вводится покупателем в корзине.
        </p>
      </div>

      {/* Создание */}
      <Card>
        <CardHeader>
          <CardTitle>Новый промокод</CardTitle>
          <CardDescription>
            Тип «процент» — скидка в %, тип «сумма» — фиксированная скидка в рублях.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className='space-y-4'
            onSubmit={(e) => {
              e.preventDefault();
              if (canCreate) createMutation.mutate();
            }}
          >
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='code'>Код</Label>
                <Input
                  id='code'
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder='WELCOME10'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='type'>Тип</Label>
                <select
                  id='type'
                  value={type}
                  onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}
                  className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm'
                >
                  <option value='percent'>Процент (%)</option>
                  <option value='fixed'>Сумма (₽)</option>
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='value'>
                  {type === 'percent' ? 'Скидка, %' : 'Скидка, ₽'}
                </Label>
                <Input
                  id='value'
                  type='number'
                  min={1}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='minOrder'>Мин. сумма заказа, ₽</Label>
                <Input
                  id='minOrder'
                  type='number'
                  min={0}
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  placeholder='необязательно'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='maxUses'>Лимит использований</Label>
                <Input
                  id='maxUses'
                  type='number'
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder='без лимита'
                />
              </div>
              <label className='flex items-center gap-2 text-sm mt-6'>
                <input
                  type='checkbox'
                  checked={perUserOnce}
                  onChange={(e) => setPerUserOnce(e.target.checked)}
                />
                Один раз на пользователя
              </label>
            </div>
            <Button type='submit' disabled={!canCreate || createMutation.isPending}>
              {createMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Список */}
      <Card>
        <CardHeader>
          <CardTitle>Активные и прошлые коды</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-2'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
          ) : codes.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Промокодов пока нет.</p>
          ) : (
            <div className='divide-y'>
              {codes.map((p) => (
                <div key={p.id} className='flex items-center gap-3 py-3'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='font-mono font-semibold'>{p.code}</span>
                      <Badge variant={p.active ? 'default' : 'secondary'}>
                        {p.active ? 'активен' : 'выключен'}
                      </Badge>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      −{valueLabel(p)}
                      {p.minOrderKopecks > 0 &&
                        ` · от ${formatPrice(p.minOrderKopecks)}`}
                      {` · использован ${p.usedCount}${
                        p.maxUses != null ? `/${p.maxUses}` : ''
                      }`}
                      {p.perUserOnce && ' · 1 на пользователя'}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => toggleMutation.mutate(p)}
                  >
                    {p.active ? 'Выключить' : 'Включить'}
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => deleteMutation.mutate(p.id)}
                    aria-label='Удалить'
                  >
                    <Trash2 className='h-4 w-4 text-destructive' />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
