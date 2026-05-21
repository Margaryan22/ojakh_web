'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import { cn } from '@/lib/utils';
import {
  DELIVERY_TIME_SLOTS,
  DEFAULT_SLOT_CAPACITY,
} from '@/lib/constants';

interface DayCalendar {
  date: string;
  unitCount: number;
  tortCount: number;
  maxUnits: number;
  maxTorts: number;
  available: boolean;
  blackedOut: boolean;
  blackoutReason: string | null;
  slotCapacities: Record<string, number> | null;
}

export default function AdminCalendarPage() {
  const queryClient = useQueryClient();
  const { data: capacities = [], isLoading } = useQuery<DayCalendar[]>({
    queryKey: ['admin-calendar'],
    queryFn: async () => {
      const { data } = await api.get('/admin/calendar?days=14');
      return data;
    },
  });

  const [editingDay, setEditingDay] = useState<DayCalendar | null>(null);
  const [maxUnits, setMaxUnits] = useState('');
  const [maxTorts, setMaxTorts] = useState('');
  const [isBlackedOut, setIsBlackedOut] = useState(false);
  const [blackoutReason, setBlackoutReason] = useState('');
  const [slotOverrides, setSlotOverrides] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const openEditor = (day: DayCalendar) => {
    setEditingDay(day);
    setMaxUnits(String(day.maxUnits));
    setMaxTorts(String(day.maxTorts));
    setIsBlackedOut(day.blackedOut);
    setBlackoutReason(day.blackoutReason ?? '');
    const overrides: Record<string, string> = {};
    for (const slot of DELIVERY_TIME_SLOTS) {
      const v = day.slotCapacities?.[slot];
      overrides[slot] = v != null ? String(v) : '';
    }
    setSlotOverrides(overrides);
  };

  const closeEditor = () => setEditingDay(null);

  const handleSave = async () => {
    if (!editingDay) return;
    setIsSaving(true);
    try {
      const slotPayload: Record<string, number> = {};
      for (const [slot, raw] of Object.entries(slotOverrides)) {
        const v = raw.trim();
        if (v === '') continue;
        const n = parseInt(v, 10);
        if (!Number.isFinite(n) || n < 0) continue;
        slotPayload[slot] = n;
      }
      await api.put(`/admin/daily-limits/${editingDay.date}`, {
        max_units: maxUnits ? parseInt(maxUnits, 10) : undefined,
        max_torts: maxTorts ? parseInt(maxTorts, 10) : undefined,
        slot_capacities: slotPayload,
        is_blacked_out: isBlackedOut,
        blackout_reason: blackoutReason.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-calendar'] });
      toast.success('Сохранено');
      closeEditor();
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка сохранения');
      } else {
        toast.error('Ошибка сохранения');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!editingDay) return;
    if (!confirm('Вернуть лимиты этого дня к дефолтным?')) return;
    setIsSaving(true);
    try {
      await api.delete(`/admin/daily-limits/${editingDay.date}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-calendar'] });
      toast.success('Сброшено к дефолтам');
      closeEditor();
    } catch {
      toast.error('Не удалось сбросить');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3'>
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className='h-28' />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <FadeIn>
        <h1 className='text-2xl font-bold'>Календарь нагрузки</h1>
      </FadeIn>

      <StaggerContainer
        immediate
        className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3'
      >
        {capacities.map((day) => {
          const unitsAtLimit = day.unitCount >= day.maxUnits;
          const tortsAtLimit = day.tortCount >= day.maxTorts;

          let colorClass = 'border-success-border bg-success-bg';
          if (day.blackedOut) {
            colorClass = 'border-zinc-400 bg-zinc-100';
          } else if (unitsAtLimit && tortsAtLimit) {
            colorClass = 'border-red-300 bg-red-50';
          } else if (unitsAtLimit || tortsAtLimit) {
            colorClass = 'border-yellow-300 bg-yellow-50';
          }

          return (
            <StaggerItem key={day.date}>
              <button
                type='button'
                onClick={() => openEditor(day)}
                className='w-full text-left'
              >
                <Card
                  className={cn(
                    'overflow-hidden transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-md cursor-pointer',
                    colorClass,
                  )}
                >
                  <CardContent className='p-3 text-center space-y-1'>
                    <p className='font-semibold text-sm'>{formatDate(day.date)}</p>
                    <div className='text-xs space-y-0.5'>
                      <p>
                        Единиц:{' '}
                        <span className='font-medium'>
                          {day.unitCount} / {day.maxUnits}
                        </span>
                      </p>
                      <p>
                        Торты:{' '}
                        <span className='font-medium'>
                          {day.tortCount} / {day.maxTorts}
                        </span>
                      </p>
                    </div>
                    {day.blackedOut && (
                      <p className='text-[10px] text-zinc-700 font-medium'>
                        Закрыто
                        {day.blackoutReason ? `: ${day.blackoutReason}` : ''}
                      </p>
                    )}
                    {!day.blackedOut && !day.available && (
                      <p className='text-[10px] text-error font-medium'>
                        Заполнено
                      </p>
                    )}
                    {day.slotCapacities && (
                      <p className='text-[10px] text-muted-foreground'>
                        Слоты: настроено
                      </p>
                    )}
                  </CardContent>
                </Card>
              </button>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      <div className='flex flex-wrap gap-4 text-xs text-muted-foreground'>
        <div className='flex items-center gap-1.5'>
          <span className='w-3 h-3 rounded bg-success-bg border border-success-border' />
          Доступно
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='w-3 h-3 rounded bg-yellow-100 border border-yellow-300' />
          Один лимит заполнен
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='w-3 h-3 rounded bg-red-100 border border-red-300' />
          Заполнено
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='w-3 h-3 rounded bg-zinc-100 border border-zinc-400' />
          Закрыто
        </div>
      </div>

      <Dialog
        open={editingDay != null}
        onOpenChange={(open) => !open && closeEditor()}
      >
        <DialogContent className='max-h-[85vh] overflow-y-auto'>
          {editingDay && (
            <>
              <DialogHeader>
                <DialogTitle>Лимиты на {formatDate(editingDay.date)}</DialogTitle>
                <DialogDescription>
                  Изменения применяются сразу. Пустое поле слота — использовать
                  дефолт ({DEFAULT_SLOT_CAPACITY}).
                </DialogDescription>
              </DialogHeader>

              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-1.5'>
                    <Label htmlFor='max-units'>Макс. единиц в день</Label>
                    <Input
                      id='max-units'
                      type='number'
                      min={0}
                      value={maxUnits}
                      onChange={(e) => setMaxUnits(e.target.value)}
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='max-torts'>Макс. тортов в день</Label>
                    <Input
                      id='max-torts'
                      type='number'
                      min={0}
                      value={maxTorts}
                      onChange={(e) => setMaxTorts(e.target.value)}
                    />
                  </div>
                </div>

                <div className='rounded-lg border border-border p-3 space-y-3'>
                  <label className='flex items-start gap-2 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={isBlackedOut}
                      onChange={(e) => setIsBlackedOut(e.target.checked)}
                      className='mt-1'
                    />
                    <div className='space-y-1'>
                      <p className='text-sm font-medium'>Закрыть день для заказов</p>
                      <p className='text-xs text-muted-foreground'>
                        Клиенты увидят дату серой с причиной (если указана).
                      </p>
                    </div>
                  </label>
                  {isBlackedOut && (
                    <Input
                      placeholder='Причина (например: санитарный день)'
                      value={blackoutReason}
                      onChange={(e) => setBlackoutReason(e.target.value)}
                      maxLength={200}
                    />
                  )}
                </div>

                <div className='space-y-2'>
                  <Label>Лимит заказов по слотам (overrides)</Label>
                  <p className='text-xs text-muted-foreground'>
                    Пусто — дефолт ({DEFAULT_SLOT_CAPACITY}). Касается только
                    курьерской доставки.
                  </p>
                  <div className='grid grid-cols-3 gap-2'>
                    {DELIVERY_TIME_SLOTS.map((slot) => (
                      <div key={slot} className='space-y-0.5'>
                        <Label
                          htmlFor={`slot-${slot}`}
                          className='text-[11px] font-normal text-muted-foreground'
                        >
                          {slot}
                        </Label>
                        <Input
                          id={`slot-${slot}`}
                          type='number'
                          min={0}
                          placeholder={String(DEFAULT_SLOT_CAPACITY)}
                          value={slotOverrides[slot] ?? ''}
                          onChange={(e) =>
                            setSlotOverrides((prev) => ({
                              ...prev,
                              [slot]: e.target.value,
                            }))
                          }
                          className='h-8 text-sm'
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className='gap-2'>
                <Button
                  variant='outline'
                  onClick={handleReset}
                  disabled={isSaving}
                  className='mr-auto'
                >
                  Сбросить к дефолтам
                </Button>
                <Button
                  variant='ghost'
                  onClick={closeEditor}
                  disabled={isSaving}
                >
                  Отмена
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Сохранение…' : 'Сохранить'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
