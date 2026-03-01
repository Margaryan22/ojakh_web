'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Minus,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Truck,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCartStore } from '@/stores/cart.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  formatPrice,
  formatDate,
  getAvailableDates,
  toDateString,
} from '@/lib/format';
import { DELIVERY_TIME_SLOTS, MAX_ITEM_QTY_PER_ORDER } from '@/lib/constants';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { DateAvailability, DeliveryTimeSlot } from '@/types';
import { AxiosError } from 'axios';

type Step = 'cart' | 'delivery' | 'confirm';

export default function CartPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    items,
    isLoading,
    fetchCart,
    updateQuantity,
    removeItem,
    clearCart,
    totalPrice,
    totalItems,
    tortCount,
  } = useCartStore();

  const [step, setStep] = useState<Step>('cart');
  const [isPickup, setIsPickup] = useState(false);
  const [address, setAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] =
    useState<DeliveryTimeSlot>('10:00-14:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableDates = getAvailableDates();
  const hasTorts = tortCount() > 0;

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const availableDateSet = useMemo(
    () => new Set(availableDates.map(toDateString)),
    [availableDates],
  );

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [calendarMonth]);

  const calendarMonthName = calendarMonth.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user, fetchCart]);

  // Date availability check
  const { data: dateAvailability } = useQuery<DateAvailability>({
    queryKey: ['dateAvailability', selectedDate, hasTorts],
    queryFn: async () => {
      const { data } = await api.get(
        `/delivery/check-date?date=${selectedDate}&with_tort=${hasTorts}`,
      );
      return data;
    },
    enabled: !!selectedDate,
  });

  const handleCheckout = () => {
    if (!user) {
      toast.error('Войдите в систему для оформления заказа');
      router.push('/login');
      return;
    }
    if (items.length === 0) {
      toast.error('Корзина пуста');
      return;
    }
    setStep('delivery');
  };

  const handleConfirmStep = () => {
    if (!selectedDate) {
      toast.error('Выберите дату доставки');
      return;
    }
    if (!isPickup && !address.trim()) {
      toast.error('Введите адрес доставки');
      return;
    }
    if (dateAvailability && !dateAvailability.available) {
      toast.error(dateAvailability.reason ?? 'Дата недоступна');
      return;
    }
    setStep('confirm');
  };

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/orders', {
        delivery_date: selectedDate,
        delivery_time: selectedTime,
        is_pickup: isPickup,
        address: isPickup ? undefined : address,
      });
      toast.success(`Заказ создан`);
      await clearCart();
      router.push(`/orders/${data.order.id}`);
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка создания заказа');
      } else {
        toast.error('Ошибка создания заказа');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTortItem = (category: string) => category === 'торты';

  if (!user) {
    return (
      <div className='text-center py-12 space-y-4'>
        <p className='text-muted-foreground'>
          Войдите в систему, чтобы просмотреть корзину
        </p>
        <Button onClick={() => router.push('/login')}>Войти</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className='h-24 w-full' />
        ))}
      </div>
    );
  }

  return (
    <div className='space-y-6 max-w-3xl mx-auto'>
      {/* Step indicator */}
      <div className='flex items-center gap-2 text-sm'>
        <span
          className={cn(
            'font-medium cursor-pointer',
            step === 'cart' ? 'text-primary' : 'text-muted-foreground',
          )}
          onClick={() => setStep('cart')}
        >
          Корзина
        </span>
        <ArrowRight className='h-3 w-3 text-muted-foreground' />
        <span
          className={cn(
            'font-medium',
            step === 'delivery' ? 'text-primary' : 'text-muted-foreground',
            step !== 'cart' ? 'cursor-pointer' : '',
          )}
          onClick={() => step !== 'cart' && setStep('delivery')}
        >
          Доставка
        </span>
        <ArrowRight className='h-3 w-3 text-muted-foreground' />
        <span
          className={cn(
            'font-medium',
            step === 'confirm' ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          Подтверждение
        </span>
      </div>

      {/* STEP 1: Cart */}
      {step === 'cart' && (
        <>
          <h1 className='text-2xl font-bold'>Корзина</h1>

          {items.length === 0 ? (
            <div className='text-center py-12 space-y-4'>
              <p className='text-muted-foreground'>Корзина пуста</p>
              <Button variant='outline' onClick={() => router.push('/catalog')}>
                Перейти в каталог
              </Button>
            </div>
          ) : (
            <>
              <div className='space-y-3'>
                {items.map((item) => {
                  const isTort = isTortItem(item.category);
                  const stepVal = isTort ? 0.5 : 1;
                  const minQty = isTort ? 1 : 1;

                  const maxQty = isTort ? 2 : MAX_ITEM_QTY_PER_ORDER;

                  return (
                    <Card
                      key={`${item.product_id}-${item.flavor}-${item.size}`}
                    >
                      <CardContent className='p-4 flex items-center gap-4'>
                        <div className='flex-1 min-w-0'>
                          <p className='font-medium text-sm truncate'>
                            {item.name}
                          </p>
                          <div className='flex gap-1 mt-0.5'>
                            {item.flavor && (
                              <Badge
                                variant='secondary'
                                className='text-[10px]'
                              >
                                {item.flavor}
                              </Badge>
                            )}
                            {item.size && (
                              <Badge
                                variant='secondary'
                                className='text-[10px]'
                              >
                                {item.size}
                              </Badge>
                            )}
                          </div>
                          <p className='text-xs text-muted-foreground mt-1'>
                            {formatPrice(item.price)} / {item.unit}
                          </p>
                        </div>

                        {/* Quantity controls */}
                        <div className='flex items-center gap-2'>
                          <Button
                            variant='outline'
                            size='icon'
                            className='h-8 w-8'
                            onClick={() => {
                              const newQty =
                                Math.round((item.quantity - stepVal) * 10) / 10;
                              if (newQty >= minQty) {
                                updateQuantity(
                                  item.product_id,
                                  newQty,
                                  item.flavor,
                                  item.size,
                                );
                              }
                            }}
                            disabled={item.quantity <= minQty}
                          >
                            <Minus className='h-3 w-3' />
                          </Button>
                          <span className='w-10 text-center text-sm font-medium tabular-nums'>
                            {isTort ? item.quantity.toFixed(1) : item.quantity}
                          </span>
                          <Button
                            variant='outline'
                            size='icon'
                            className='h-8 w-8'
                            onClick={() => {
                              const newQty =
                                Math.round((item.quantity + stepVal) * 10) / 10;
                              updateQuantity(
                                item.product_id,
                                newQty,
                                item.flavor,
                                item.size,
                              );
                            }}
                            disabled={item.quantity >= maxQty}
                          >
                            <Plus className='h-3 w-3' />
                          </Button>
                        </div>

                        {/* Subtotal & remove */}
                        <div className='text-right'>
                          <p className='font-semibold text-sm'>
                            {formatPrice(item.subtotal)}
                          </p>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-1 text-muted-foreground hover:text-destructive'
                            onClick={() =>
                              removeItem(
                                item.product_id,
                                item.flavor,
                                item.size,
                              )
                            }
                          >
                            <Trash2 className='h-3 w-3' />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Separator />

              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>
                    {totalItems()} {totalItems() === 1 ? 'товар' : 'товаров'}
                  </p>
                  <p className='text-xl font-bold'>
                    {formatPrice(totalPrice())}
                  </p>
                </div>
                <div className='flex gap-2'>
                  <Button variant='outline' onClick={() => clearCart()}>
                    Очистить
                  </Button>
                  <Button onClick={handleCheckout}>Оформить</Button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* STEP 2: Delivery */}
      {step === 'delivery' && (
        <>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='icon' onClick={() => setStep('cart')}>
              <ArrowLeft className='h-4 w-4' />
            </Button>
            <h1 className='text-2xl font-bold'>Доставка</h1>
          </div>

          <div className='space-y-6'>
            {/* Delivery type toggle */}
            <div className='flex gap-3'>
              <Button
                variant={!isPickup ? 'default' : 'outline'}
                className='flex-1 gap-2'
                onClick={() => setIsPickup(false)}
              >
                <Truck className='h-4 w-4' />
                Доставка
              </Button>
              <Button
                variant={isPickup ? 'default' : 'outline'}
                className='flex-1 gap-2'
                onClick={() => setIsPickup(true)}
              >
                <Store className='h-4 w-4' />
                Самовывоз
              </Button>
            </div>

            {/* Address */}
            {!isPickup && (
              <div className='space-y-2'>
                <Label htmlFor='address'>Адрес доставки</Label>
                <div className='relative'>
                  <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                  <Input
                    id='address'
                    placeholder='Улица, дом, квартира'
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>
            )}

            {/* Date selection - Calendar */}
            <div className='space-y-2'>
              <Label>Дата доставки</Label>

              {/* Month navigation */}
              <div className='flex items-center justify-between'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() =>
                    setCalendarMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                    )
                  }
                >
                  <ArrowLeft className='h-4 w-4' />
                </Button>
                <span className='font-medium text-sm capitalize'>
                  {calendarMonthName}
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() =>
                    setCalendarMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                    )
                  }
                >
                  <ArrowRight className='h-4 w-4' />
                </Button>
              </div>

              {/* Day of week headers */}
              <div className='grid grid-cols-7 text-center'>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                  <div
                    key={d}
                    className='text-xs text-muted-foreground py-1 font-medium'
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar days grid */}
              <div className='grid grid-cols-7 gap-1'>
                {calendarDays.map((date, idx) => {
                  if (!date) return <div key={`empty-${idx}`} />;
                  const dateStr = toDateString(date);
                  const isAvailable = availableDateSet.has(dateStr);
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      disabled={!isAvailable}
                      onClick={() => setSelectedDate(dateStr)}
                      className={cn(
                        'h-9 w-full rounded-lg text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : isAvailable
                            ? 'hover:bg-accent cursor-pointer'
                            : 'text-muted-foreground/40 cursor-not-allowed',
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* Date availability info */}
              {dateAvailability && selectedDate && (
                <div className='text-xs space-y-1 mt-2'>
                  <p
                    className={cn(
                      dateAvailability.available
                        ? 'text-green-600'
                        : 'text-red-600',
                    )}
                  >
                    {dateAvailability.available
                      ? 'Дата доступна'
                      : (dateAvailability.reason ?? 'Дата недоступна')}
                  </p>
                  {hasTorts && (
                    <p className='text-muted-foreground'>
                      Тортов на эту дату: {dateAvailability.tortCount} /{' '}
                      {dateAvailability.maxTorts}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Time slot */}
            <div className='space-y-2'>
              <Label>Время доставки</Label>
              <div className='flex gap-2'>
                {DELIVERY_TIME_SLOTS.map((slot) => (
                  <Button
                    key={slot}
                    variant={selectedTime === slot ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setSelectedTime(slot)}
                    className='flex-1'
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            </div>

            <Button className='w-full' onClick={handleConfirmStep}>
              Далее
            </Button>
          </div>
        </>
      )}

      {/* STEP 3: Confirmation */}
      {step === 'confirm' && (
        <>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setStep('delivery')}
            >
              <ArrowLeft className='h-4 w-4' />
            </Button>
            <h1 className='text-2xl font-bold'>Подтверждение</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Состав заказа</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {items.map((item) => (
                <div
                  key={`${item.product_id}-${item.flavor}-${item.size}`}
                  className='flex justify-between items-center text-sm'
                >
                  <span>
                    {item.name}
                    {item.flavor ? ` (${item.flavor})` : ''}
                    {item.size ? ` ${item.size}` : ''} &times; {item.quantity}{' '}
                    {item.unit}
                  </span>
                  <span className='font-medium'>
                    {formatPrice(item.subtotal)}
                  </span>
                </div>
              ))}
              <Separator />
              <div className='flex justify-between font-bold'>
                <span>Итого:</span>
                <span>{formatPrice(totalPrice())}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Доставка</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2 text-sm'>
              <p>
                <span className='text-muted-foreground'>Тип:</span>{' '}
                {isPickup ? 'Самовывоз' : 'Доставка'}
              </p>
              {!isPickup && (
                <p>
                  <span className='text-muted-foreground'>Адрес:</span>{' '}
                  {address}
                </p>
              )}
              <p>
                <span className='text-muted-foreground'>Дата:</span>{' '}
                {formatDate(selectedDate)}
              </p>
              <p>
                <span className='text-muted-foreground'>Время:</span>{' '}
                {selectedTime}
              </p>
            </CardContent>
          </Card>

          <Button
            className='w-full'
            size='lg'
            onClick={handleSubmitOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Оформление...' : 'Оформить заказ'}
          </Button>
        </>
      )}
    </div>
  );
}
