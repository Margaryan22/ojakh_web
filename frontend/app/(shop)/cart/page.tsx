'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [addressValidated, setAddressValidated] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] =
    useState<DeliveryTimeSlot>('10:00-12:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [isLoadingCost, setIsLoadingCost] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // DaData address suggestions with debounce
  useEffect(() => {
    if (isPickup || address.length < 5) {
      setAddressSuggestions([]);
      return;
    }
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    addressDebounceRef.current = setTimeout(async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_DADATA_API_KEY;
        if (!apiKey) return;
        const res = await fetch(
          'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Token ${apiKey}`,
            },
            body: JSON.stringify({
              query: address,
              count: 5,
              locations: [{ city: 'Нижний Новгород' }],
            }),
          },
        );
        const data = await res.json();
        const values: string[] = (data.suggestions ?? []).map(
          (s: { value: string }) => s.value,
        );
        setAddressSuggestions(values);
      } catch {
        // ignore suggestion errors
      }
    }, 400);
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, [address, isPickup]);

  // Bulk calendar availability (fetched when delivery step opens)
  const { data: calendarData } = useQuery<
    Array<DateAvailability & { date: string }>
  >({
    queryKey: ['deliveryCalendar', hasTorts],
    queryFn: async () => {
      const { data } = await api.get(
        `/delivery/calendar?with_tort=${hasTorts}`,
      );
      return data;
    },
    enabled: step === 'delivery',
  });

  const bookedDateSet = useMemo(() => {
    if (!calendarData) return new Set<string>();
    return new Set(calendarData.filter((d) => !d.available).map((d) => d.date));
  }, [calendarData]);

  // Single-date availability check (after user selects a date)
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

  const handleConfirmStep = async () => {
    if (!selectedDate) {
      toast.error('Выберите дату доставки');
      return;
    }
    if (!isPickup && !address.trim()) {
      toast.error('Введите адрес доставки');
      return;
    }
    if (!isPickup && address.trim() && !addressValidated) {
      toast.error('Пожалуйста, выберите адрес из предложенного списка');
      return;
    }
    if (dateAvailability && !dateAvailability.available) {
      toast.error(dateAvailability.reason ?? 'Дата недоступна');
      return;
    }

    // Fetch delivery cost
    if (!isPickup) {
      setIsLoadingCost(true);
      try {
        const { data } = await api.get(
          `/delivery/cost?address=${encodeURIComponent(address)}`,
        );
        setDeliveryCost(data.cost);
      } catch {
        setDeliveryCost(50000); // fallback 500₽
      } finally {
        setIsLoadingCost(false);
      }
    } else {
      setDeliveryCost(0);
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

                  const maxQty = item.maxPerCart ?? (isTort ? 2 : MAX_ITEM_QTY_PER_ORDER);

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
                              if (newQty < minQty) {
                                removeItem(
                                  item.product_id,
                                  item.flavor,
                                  item.size,
                                );
                              } else {
                                updateQuantity(
                                  item.product_id,
                                  newQty,
                                  item.flavor,
                                  item.size,
                                );
                              }
                            }}
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
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setAddressValidated(false);
                    }}
                    className='pl-10'
                    autoComplete='off'
                  />
                  {addressSuggestions.length > 0 && (
                    <ul className='absolute z-30 top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto'>
                      {addressSuggestions.map((s, i) => (
                        <li
                          key={i}
                          className='px-3 py-2 text-sm cursor-pointer hover:bg-accent'
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setAddress(s);
                            setAddressSuggestions([]);
                            setAddressValidated(true);
                          }}
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Доставка осуществляется только по Нижнему Новгороду
                </p>
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
                  const isInRange = availableDateSet.has(dateStr);
                  const isBooked = bookedDateSet.has(dateStr);
                  const isAvailable = isInRange && !isBooked;
                  const isSelected = selectedDate === dateStr;
                  return (
                    <div key={dateStr} className={cn('relative', isBooked && 'group/day')}>
                      <button
                        disabled={!isAvailable}
                        onClick={() => setSelectedDate(dateStr)}
                        className={cn(
                          'h-9 w-full rounded-lg text-sm font-medium transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : isBooked
                              ? 'text-muted-foreground/40 cursor-not-allowed'
                              : isInRange
                                ? 'hover:bg-accent cursor-pointer'
                                : 'text-muted-foreground/40 cursor-not-allowed',
                        )}
                      >
                        {date.getDate()}
                      </button>
                      {isBooked && (
                        <div className='pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 group-hover/day:block z-20 w-44 rounded-lg bg-foreground px-2.5 py-2 text-center text-xs text-background shadow-lg'>
                          Заказов очень много на этот день, выбери другой
                          <span className='absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground' />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Date availability info */}
              {dateAvailability && selectedDate && !dateAvailability.available && (
                <p className='text-sm text-foreground mt-2'>
                  Заказов очень много на этот день, выбери другой
                </p>
              )}
              {dateAvailability && selectedDate && hasTorts && (
                <p className='text-xs text-muted-foreground mt-1'>
                  Тортов на эту дату: {dateAvailability.tortCount} /{' '}
                  {dateAvailability.maxTorts}
                </p>
              )}
            </div>

            {/* Time slot */}
            <div className='space-y-2'>
              <Label>Время доставки</Label>
              <div className='grid grid-cols-3 gap-2'>
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
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Товары:</span>
                <span>{formatPrice(totalPrice())}</span>
              </div>
              {deliveryCost > 0 && (
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Доставка:</span>
                  <span>{isLoadingCost ? '...' : formatPrice(deliveryCost)}</span>
                </div>
              )}
              {isPickup && (
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Доставка:</span>
                  <span className='text-green-600'>Бесплатно (самовывоз)</span>
                </div>
              )}
              <div className='flex justify-between font-bold'>
                <span>Итого:</span>
                <span>{formatPrice(totalPrice() + deliveryCost)}</span>
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
