'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Minus,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Truck,
  Store,
  CheckCircle2,
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
import {
  DELIVERY_TIME_SLOTS,
  MAX_ITEM_QTY_PER_ORDER,
  CAKE_CATEGORY,
  FALLBACK_DELIVERY_COST,
  FREE_DELIVERY_THRESHOLD_KOPECKS,
  MIN_ORDER_KOPECKS,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  WAREHOUSE_ADDRESS,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { FadeIn } from '@/components/motion/fade-in';
import { DUR_BASE, EASE_OUT } from '@/components/motion/motion-presets';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  DateAvailability,
  DeliveryTimeSlot,
  AddressSuggestion,
  DeliveryCostBreakdown,
  UserAddress,
} from '@/types';
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
  const [addressCoords, setAddressCoords] = useState<{ lat: number | null; lon: number | null }>({
    lat: null,
    lon: null,
  });
  const [recipientName, setRecipientName] = useState('');
  const [addressApartment, setAddressApartment] = useState('');
  const [addressEntrance, setAddressEntrance] = useState('');
  const [addressFloor, setAddressFloor] = useState('');
  const [addressIntercom, setAddressIntercom] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [costBreakdown, setCostBreakdown] = useState<DeliveryCostBreakdown | null>(
    null,
  );
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressValidated, setAddressValidated] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] =
    useState<DeliveryTimeSlot>('10:00-11:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [isLoadingCost, setIsLoadingCost] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableDates = getAvailableDates();
  const cartUnits = totalItems();
  const cartTorts = tortCount();
  const hasTorts = cartTorts > 0;

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
    // Для гостя fetchCart — no-op (persist уже восстановил), для юзера тянет с сервера.
    fetchCart();
  }, [user, fetchCart]);

  // DaData address suggestions via backend proxy (DaData key stays server-side)
  useEffect(() => {
    if (isPickup || address.length < 5) {
      setAddressSuggestions([]);
      return;
    }
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    addressDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/delivery/suggest-address', {
          params: { q: address },
        });
        setAddressSuggestions(data.suggestions ?? []);
      } catch {
        // ignore suggestion errors
      }
    }, 400);
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, [address, isPickup]);

  // Bulk calendar availability (учитывает корзину: для гостей через query, для юзеров — на бэке)
  const { data: calendarData } = useQuery<
    Array<DateAvailability & { date: string }>
  >({
    queryKey: ['deliveryCalendar', hasTorts, cartUnits, cartTorts],
    queryFn: async () => {
      const params = new URLSearchParams({
        with_tort: String(hasTorts),
        extra_units: String(cartUnits),
        extra_torts: String(cartTorts),
      });
      const { data } = await api.get(`/delivery/calendar?${params}`);
      return data;
    },
    enabled: items.length > 0,
  });

  const bookedDateSet = useMemo(() => {
    if (!calendarData) return new Set<string>();
    return new Set(calendarData.filter((d) => !d.available).map((d) => d.date));
  }, [calendarData]);

  const calendarReasonByDate = useMemo(() => {
    const map: Record<string, string> = {};
    if (!calendarData) return map;
    for (const d of calendarData) if (!d.available && d.reason) map[d.date] = d.reason;
    return map;
  }, [calendarData]);

  const availableCalendarDates = useMemo(() => {
    if (!calendarData) return [];
    return calendarData.filter((d) => d.available);
  }, [calendarData]);

  const noDatesFit = !!calendarData && availableCalendarDates.length === 0 && items.length > 0;

  // Распределяем недоступные даты по причине, чтобы сообщение было точным.
  const blockBreakdown = useMemo(() => {
    if (!calendarData) return { tortBlocked: 0, unitBlocked: 0, total: 0 };
    let tortBlocked = 0;
    let unitBlocked = 0;
    for (const d of calendarData) {
      if (d.available) continue;
      const tortFull = hasTorts && d.tortsAvailable < cartTorts;
      const unitFull = d.unitsAvailable < cartUnits;
      if (tortFull && !unitFull) tortBlocked++;
      else if (unitFull) unitBlocked++;
    }
    return { tortBlocked, unitBlocked, total: tortBlocked + unitBlocked };
  }, [calendarData, hasTorts, cartTorts, cartUnits]);

  const blockReason: 'torts' | 'units' | 'mixed' = (() => {
    const { tortBlocked, unitBlocked } = blockBreakdown;
    if (tortBlocked > 0 && unitBlocked === 0) return 'torts';
    if (unitBlocked > 0 && tortBlocked === 0) return 'units';
    return 'mixed';
  })();

  // Single-date availability check (после выбора даты)
  const { data: dateAvailability } = useQuery<DateAvailability>({
    queryKey: ['dateAvailability', selectedDate, hasTorts, cartUnits, cartTorts],
    queryFn: async () => {
      const params = new URLSearchParams({
        date: selectedDate,
        with_tort: String(hasTorts),
        extra_units: String(cartUnits),
        extra_torts: String(cartTorts),
      });
      const { data } = await api.get(`/delivery/check-date?${params}`);
      return data;
    },
    enabled: !!selectedDate,
  });

  // Если выбранный слот закрылся (за время раздумий, или из-за смены даты),
  // подменяем на первый доступный — иначе кнопка «Далее» молча упрётся в 400.
  useEffect(() => {
    if (isPickup) return;
    const slots = dateAvailability?.slots;
    if (!slots) return;
    const current = slots[selectedTime];
    if (current && current.available) return;
    const firstFree = DELIVERY_TIME_SLOTS.find((s) => slots[s]?.available);
    if (firstFree && firstFree !== selectedTime) {
      setSelectedTime(firstFree);
    }
  }, [dateAvailability, isPickup, selectedTime]);

  // Live-расчёт стоимости доставки на delivery-шаге — чтобы клиент видел цену
  // ещё до клика «Далее». Триггерится при подтверждённом адресе и валидной дате.
  const liveCostEnabled =
    step === 'delivery' &&
    !isPickup &&
    addressValidated &&
    address.trim().length > 0;

  const { data: liveCostData } = useQuery<{
    cost: number;
    distanceKm: number | null;
    freeDelivery: boolean;
    breakdown: DeliveryCostBreakdown;
  }>({
    queryKey: [
      'deliveryCost',
      address,
      addressCoords.lat,
      addressCoords.lon,
      totalPrice(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ address });
      if (addressCoords.lat != null) params.set('lat', String(addressCoords.lat));
      if (addressCoords.lon != null) params.set('lon', String(addressCoords.lon));
      params.set('subtotal', String(totalPrice()));
      const { data } = await api.get(`/delivery/cost?${params.toString()}`);
      return data;
    },
    enabled: liveCostEnabled,
    staleTime: 30_000,
  });

  // Saved delivery addresses (для chip-списка над инпутом адреса).
  const { data: savedAddresses } = useQuery<UserAddress[]>({
    queryKey: ['savedAddresses'],
    queryFn: async () => {
      const { data } = await api.get('/addresses');
      return data;
    },
    enabled: !!user && step === 'delivery',
    staleTime: 5 * 60 * 1000,
  });

  function applySavedAddress(a: UserAddress) {
    setAddress(a.address);
    setAddressCoords({ lat: a.lat, lon: a.lon });
    setAddressSuggestions([]);
    setAddressValidated(true);
    setAddressApartment(a.apartment ?? '');
    setAddressEntrance(a.entrance ?? '');
    setAddressFloor(a.floor ?? '');
    setAddressIntercom(a.intercom ?? '');
    setDeliveryNotes(a.notes ?? '');
  }

  function describeBreakdown(b: DeliveryCostBreakdown | null): string | null {
    if (!b) return null;
    if (b.type === 'free_threshold') {
      return `Бесплатно при заказе от ${formatPrice(b.thresholdKopecks)}`;
    }
    if (b.type === 'fallback') {
      return 'Базовый тариф — уточнится после проверки адреса';
    }
    // distance
    if (b.extraKm === 0) {
      return `${formatPrice(b.baseKopecks)} за первые ${b.freeKm} км`;
    }
    return `${formatPrice(b.baseKopecks)} за первые ${b.freeKm} км + ${b.extraKm} км × ${formatPrice(b.perKmKopecks)}`;
  }

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.error('Корзина пуста');
      return;
    }
    if (!user) {
      toast.info('Войдите, чтобы оформить заказ');
      router.push('/login?next=/cart');
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
    if (!isPickup) {
      const slot = dateAvailability?.slots?.[selectedTime];
      if (slot && !slot.available) {
        toast.error('Этот интервал уже занят, выберите другой');
        return;
      }
    }

    // Fetch delivery cost (используем закэшированный liveCostData, если есть)
    if (!isPickup) {
      if (liveCostData) {
        setDeliveryCost(liveCostData.cost);
        setCostBreakdown(liveCostData.breakdown ?? null);
      } else {
        setIsLoadingCost(true);
        try {
          const params = new URLSearchParams({ address });
          if (addressCoords.lat != null) params.set('lat', String(addressCoords.lat));
          if (addressCoords.lon != null) params.set('lon', String(addressCoords.lon));
          params.set('subtotal', String(totalPrice()));
          const { data } = await api.get(`/delivery/cost?${params.toString()}`);
          setDeliveryCost(data.cost);
          setCostBreakdown(data.breakdown ?? null);
        } catch {
          setDeliveryCost(
            totalPrice() >= FREE_DELIVERY_THRESHOLD_KOPECKS
              ? 0
              : FALLBACK_DELIVERY_COST,
          );
          setCostBreakdown(null);
        } finally {
          setIsLoadingCost(false);
        }
      }
    } else {
      setDeliveryCost(0);
      setCostBreakdown(null);
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
        address_lat: isPickup ? undefined : addressCoords.lat ?? undefined,
        address_lon: isPickup ? undefined : addressCoords.lon ?? undefined,
        recipient_name: isPickup ? undefined : recipientName.trim() || undefined,
        address_apartment: isPickup
          ? undefined
          : addressApartment.trim() || undefined,
        address_entrance: isPickup
          ? undefined
          : addressEntrance.trim() || undefined,
        address_floor: isPickup ? undefined : addressFloor.trim() || undefined,
        address_intercom: isPickup
          ? undefined
          : addressIntercom.trim() || undefined,
        delivery_notes: isPickup
          ? undefined
          : deliveryNotes.trim() || undefined,
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

  const isTortItem = (category: string) => category === CAKE_CATEGORY;

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
    <FadeIn>
    <div className='space-y-6 max-w-3xl mx-auto'>
      {/* Step indicator */}
      <div className='flex items-center gap-2 text-sm'>
        <span
          className={cn(
            'relative font-medium cursor-pointer pb-1 transition-colors duration-200',
            step === 'cart' ? 'text-primary' : 'text-muted-foreground',
          )}
          onClick={() => setStep('cart')}
        >
          Корзина
          {step === 'cart' && (
            <motion.span
              layoutId='cart-step-active'
              className='absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-primary'
              transition={{ type: 'tween', duration: DUR_BASE, ease: EASE_OUT }}
            />
          )}
        </span>
        <ArrowRight className='h-3 w-3 text-muted-foreground' />
        <span
          className={cn(
            'relative font-medium pb-1 transition-colors duration-200',
            step === 'delivery' ? 'text-primary' : 'text-muted-foreground',
            step !== 'cart' ? 'cursor-pointer' : '',
          )}
          onClick={() => step !== 'cart' && setStep('delivery')}
        >
          Доставка
          {step === 'delivery' && (
            <motion.span
              layoutId='cart-step-active'
              className='absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-primary'
              transition={{ type: 'tween', duration: DUR_BASE, ease: EASE_OUT }}
            />
          )}
        </span>
        <ArrowRight className='h-3 w-3 text-muted-foreground' />
        <span
          className={cn(
            'relative font-medium pb-1 transition-colors duration-200',
            step === 'confirm' ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          Подтверждение
          {step === 'confirm' && (
            <motion.span
              layoutId='cart-step-active'
              className='absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-primary'
              transition={{ type: 'tween', duration: DUR_BASE, ease: EASE_OUT }}
            />
          )}
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
                <AnimatePresence initial={false}>
                {items.map((item) => {
                  const isTort = isTortItem(item.category);
                  const stepVal = isTort ? 0.5 : 1;
                  const minQty = isTort ? 1 : 1;

                  const maxQty = item.maxPerCart ?? (isTort ? 2 : MAX_ITEM_QTY_PER_ORDER);

                  return (
                    <motion.div
                      key={`${item.product_id}-${item.flavor}-${item.size}`}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: DUR_BASE, ease: EASE_OUT }}
                      className='overflow-hidden'
                    >
                    <Card>
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
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>

              <Separator />

              {/* Превью доступности дат с учётом корзины */}
              {calendarData && (
                <div
                  className={cn(
                    'rounded-lg border p-3 text-sm',
                    noDatesFit
                      ? 'border-destructive/50 bg-destructive/5 text-destructive'
                      : 'border-border/60 bg-muted/30',
                  )}
                >
                  {noDatesFit ? (
                    <>
                      <p className='font-medium'>
                        {blockReason === 'torts'
                          ? 'Все торты разобраны на ближайшие дни'
                          : blockReason === 'units'
                            ? 'Заказ слишком большой для ближайших дней'
                            : 'Нет подходящих дат для вашего заказа'}
                      </p>
                      <p className='text-xs mt-1 opacity-90'>
                        {(() => {
                          const maxAvailableUnits = Math.max(
                            ...calendarData.map((d) => d.unitsAvailable),
                            0,
                          );
                          const maxAvailableTorts = Math.max(
                            ...calendarData.map((d) => d.tortsAvailable),
                            0,
                          );
                          if (blockReason === 'torts') {
                            return `На ближайшие ${calendarData.length} дней свободно тортов на дату: максимум ${maxAvailableTorts}. У вас в корзине ${cartTorts}. Уменьшите количество тортов или попробуйте позже.`;
                          }
                          if (blockReason === 'units') {
                            return `На ближайшие ${calendarData.length} дней свободно единиц на дату: максимум ${maxAvailableUnits}. У вас в корзине ${cartUnits}. Уменьшите количество товаров.`;
                          }
                          return `Уменьшите количество тортов (макс ${maxAvailableTorts}/день) или единиц (макс ${maxAvailableUnits}/день) — на ближайшие ${calendarData.length} дней нет места под такой объём.`;
                        })()}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className='font-medium text-foreground'>
                        Ближайшие доступные даты:
                      </p>
                      <p className='text-muted-foreground mt-1'>
                        {availableCalendarDates
                          .slice(0, 3)
                          .map((d) => formatDate(d.date))
                          .join(' · ')}
                        {availableCalendarDates.length > 3 && ' · …'}
                      </p>
                    </>
                  )}
                </div>
              )}

              {!user && (
                <div className='rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3'>
                  <span className='flex-1 text-foreground'>
                    Для оформления заказа нужно войти или зарегистрироваться. Корзина сохранится.
                  </span>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => router.push('/login?next=/cart')}
                    >
                      Войти
                    </Button>
                    <Button
                      size='sm'
                      onClick={() => router.push('/register?next=/cart')}
                    >
                      Регистрация
                    </Button>
                  </div>
                </div>
              )}

              {/* Минимальная сумма заказа */}
              {totalPrice() < MIN_ORDER_KOPECKS && (
                <div className='rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300'>
                  <p>
                    Минимальная сумма заказа — {formatPrice(MIN_ORDER_KOPECKS)}.{' '}
                    Добавьте ещё на{' '}
                    <span className='font-semibold'>
                      {formatPrice(MIN_ORDER_KOPECKS - totalPrice())}
                    </span>
                    , чтобы оформить.
                  </p>
                </div>
              )}

              {/* Free-delivery motivation banner */}
              {(() => {
                const sub = totalPrice();
                if (sub >= FREE_DELIVERY_THRESHOLD_KOPECKS) {
                  return (
                    <div className='rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400'>
                      Доставка по этому заказу будет бесплатной.
                    </div>
                  );
                }
                const remaining = FREE_DELIVERY_THRESHOLD_KOPECKS - sub;
                const pct = Math.min(
                  100,
                  Math.round((sub / FREE_DELIVERY_THRESHOLD_KOPECKS) * 100),
                );
                return (
                  <div className='rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2'>
                    <p>
                      Добавьте ещё на{' '}
                      <span className='font-semibold text-foreground'>
                        {formatPrice(remaining)}
                      </span>{' '}
                      — и доставка будет бесплатной.
                    </p>
                    <div className='h-1.5 w-full rounded-full bg-border overflow-hidden'>
                      <div
                        className='h-full bg-primary transition-[width] duration-500 ease-out-soft'
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>
                    {totalItems()} {totalItems() === 1 ? 'товар' : 'товаров'}
                  </p>
                  <AnimatePresence mode='wait'>
                    <motion.p
                      key={totalPrice()}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className='text-xl font-bold'
                    >
                      {formatPrice(totalPrice())}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <div className='flex gap-2'>
                  <Button variant='outline' onClick={() => clearCart()}>
                    Очистить
                  </Button>
                  <Button
                    onClick={handleCheckout}
                    disabled={noDatesFit || totalPrice() < MIN_ORDER_KOPECKS}
                  >
                    Оформить
                  </Button>
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

            {/* Pickup address */}
            {isPickup && (
              <div className='rounded-lg border border-border bg-muted/30 p-4 flex gap-3'>
                <MapPin className='h-5 w-5 shrink-0 text-primary mt-0.5' />
                <div className='space-y-1 text-sm'>
                  <p className='font-medium'>Адрес самовывоза</p>
                  <p>{WAREHOUSE_ADDRESS}</p>
                  <p className='text-xs text-muted-foreground'>
                    Приезжайте в выбранный день и интервал времени — заказ будет
                    готов к выдаче.
                  </p>
                </div>
              </div>
            )}

            {/* Address */}
            {!isPickup && (
              <div className='space-y-2'>
                <Label htmlFor='address'>Адрес доставки</Label>

                {/* Сохранённые адреса — chip-список */}
                {savedAddresses && savedAddresses.length > 0 && (
                  <div className='flex flex-wrap gap-1.5'>
                    {savedAddresses.map((a) => {
                      const isActive = address === a.address;
                      return (
                        <button
                          key={a.id}
                          type='button'
                          onClick={() => applySavedAddress(a)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors',
                            isActive
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:bg-accent',
                          )}
                          title={a.address}
                        >
                          <MapPin className='h-3 w-3' />
                          <span className='truncate max-w-45'>
                            {a.label ?? a.address}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className='relative'>
                  <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                  <Input
                    id='address'
                    placeholder='Улица, дом, квартира'
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setAddressValidated(false);
                      setAddressCoords({ lat: null, lon: null });
                    }}
                    onFocus={() => setAddressFocused(true)}
                    onBlur={() => setAddressFocused(false)}
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
                            setAddress(s.value);
                            setAddressCoords({ lat: s.geoLat, lon: s.geoLon });
                            setAddressSuggestions([]);
                            setAddressValidated(true);
                          }}
                        >
                          {s.value}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {addressValidated ? (
                  <p className='text-xs text-green-700 dark:text-green-400 inline-flex items-center gap-1'>
                    <CheckCircle2 className='h-3.5 w-3.5' />
                    Адрес подтверждён
                  </p>
                ) : (
                  <p className='text-xs text-muted-foreground'>
                    Выберите адрес из выпадающего списка — мы доставляем только по Нижнему Новгороду.
                  </p>
                )}
                <p className='text-xs text-muted-foreground'>
                  Бесплатно при заказе от {formatPrice(FREE_DELIVERY_THRESHOLD_KOPECKS)}.{' '}
                  <Link
                    href='/profile/addresses'
                    className='underline hover:text-foreground'
                  >
                    Управление адресами
                  </Link>
                </p>

                {/* Address details: optional fields to help the courier */}
                <div className='grid grid-cols-2 gap-3 pt-2'>
                  <div className='space-y-1'>
                    <Label htmlFor='apt'>Квартира / офис</Label>
                    <Input
                      id='apt'
                      value={addressApartment}
                      onChange={(e) => setAddressApartment(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='entrance'>Подъезд</Label>
                    <Input
                      id='entrance'
                      value={addressEntrance}
                      onChange={(e) => setAddressEntrance(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='floor'>Этаж</Label>
                    <Input
                      id='floor'
                      value={addressFloor}
                      onChange={(e) => setAddressFloor(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='intercom'>Домофон</Label>
                    <Input
                      id='intercom'
                      value={addressIntercom}
                      onChange={(e) => setAddressIntercom(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className='space-y-1 pt-2'>
                  <Label htmlFor='notes'>Комментарий курьеру (необязательно)</Label>
                  <textarea
                    id='notes'
                    rows={2}
                    maxLength={500}
                    placeholder='Например: позвоните за 10 минут'
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none'
                  />
                </div>

                <div className='space-y-1 pt-2'>
                  <Label htmlFor='recipient'>Получатель (необязательно)</Label>
                  <Input
                    id='recipient'
                    placeholder='Имя получателя — если торт принимаете не вы'
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    autoComplete='name'
                  />
                  <p className='text-xs text-muted-foreground'>
                    Заполните, если заказ принимает другой человек (например, подарок). Иначе передадим имя из профиля.
                  </p>
                </div>

                {/* Live стоимость доставки + разбивка */}
                {liveCostData && (
                  <div className='rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1 mt-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>Стоимость доставки:</span>
                      <span className='font-semibold'>
                        {liveCostData.freeDelivery
                          ? 'Бесплатно'
                          : formatPrice(liveCostData.cost)}
                      </span>
                    </div>
                    {describeBreakdown(liveCostData.breakdown) && (
                      <p className='text-xs text-muted-foreground'>
                        {describeBreakdown(liveCostData.breakdown)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Date selection - Calendar */}
            <div className='space-y-2'>
              <Label>Дата доставки</Label>
              <p className='text-xs text-muted-foreground'>
                Доставка возможна не раньше чем через {MIN_DAYS_AHEAD} дня и не позже чем через {MAX_DAYS_AHEAD} дней — это связано с графиком ручного производства.
              </p>

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
                  const tooltipText =
                    calendarReasonByDate[dateStr] ??
                    'Заказов очень много на этот день, выбери другой';
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
                        <div className='pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 group-hover/day:block z-20 w-52 rounded-lg bg-foreground px-2.5 py-2 text-center text-xs text-background shadow-lg'>
                          {tooltipText}
                          <span className='absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground' />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Date availability info */}
              {dateAvailability && selectedDate && !dateAvailability.available && (
                <div className='mt-2 space-y-1'>
                  <p className='text-sm text-destructive'>
                    {dateAvailability.reason ??
                      'Заказов очень много на этот день, выбери другой'}
                  </p>
                  {availableCalendarDates.length > 0 && (
                    <p className='text-xs text-muted-foreground'>
                      Свободно на:{' '}
                      {availableCalendarDates
                        .slice(0, 3)
                        .map((d) => formatDate(d.date))
                        .join(' · ')}
                      {availableCalendarDates.length > 3 && ' · …'}
                    </p>
                  )}
                </div>
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
                {DELIVERY_TIME_SLOTS.map((slot) => {
                  // Slot capacity ограничивает только курьерскую доставку.
                  // Для самовывоза любой слот доступен (нагрузка через дневной лимит).
                  const slotInfo = !isPickup
                    ? dateAvailability?.slots?.[slot]
                    : undefined;
                  const isFull = slotInfo ? !slotInfo.available : false;
                  const remaining = slotInfo
                    ? Math.max(0, slotInfo.max - slotInfo.count)
                    : null;
                  return (
                    <div key={slot} className='flex flex-col'>
                      <Button
                        variant={selectedTime === slot ? 'default' : 'outline'}
                        size='sm'
                        disabled={isFull}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </Button>
                      {remaining !== null && remaining > 0 && remaining <= 2 && (
                        <span className='text-[10px] text-muted-foreground text-center mt-0.5'>
                          осталось {remaining}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isPickup &&
                dateAvailability?.slots &&
                Object.values(dateAvailability.slots).every((s) => !s.available) && (
                  <p className='text-sm text-destructive mt-1'>
                    Все интервалы доставки на эту дату заняты — выберите другую дату.
                  </p>
                )}
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
              {!isPickup && deliveryCost > 0 && (
                <div className='space-y-0.5'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>Доставка:</span>
                    <span>{isLoadingCost ? '...' : formatPrice(deliveryCost)}</span>
                  </div>
                  {describeBreakdown(costBreakdown) && (
                    <p className='text-[11px] text-muted-foreground text-right'>
                      {describeBreakdown(costBreakdown)}
                    </p>
                  )}
                </div>
              )}
              {!isPickup && deliveryCost === 0 && !isLoadingCost && (
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Доставка:</span>
                  <span className='text-green-600'>
                    Бесплатно (от {formatPrice(FREE_DELIVERY_THRESHOLD_KOPECKS)})
                  </span>
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
                <>
                  <p>
                    <span className='text-muted-foreground'>Адрес:</span>{' '}
                    {address}
                  </p>
                  {(addressApartment ||
                    addressEntrance ||
                    addressFloor ||
                    addressIntercom) && (
                    <p className='text-xs text-muted-foreground'>
                      {[
                        addressApartment && `кв./офис ${addressApartment}`,
                        addressEntrance && `подъезд ${addressEntrance}`,
                        addressFloor && `этаж ${addressFloor}`,
                        addressIntercom && `домофон ${addressIntercom}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {deliveryNotes.trim() && (
                    <p className='text-xs text-muted-foreground'>
                      Комментарий: {deliveryNotes.trim()}
                    </p>
                  )}
                </>
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
          <p className='text-xs text-muted-foreground text-center'>
            Нажимая «Оформить заказ», вы создаёте заказ — оплата на следующем шаге.
          </p>
        </>
      )}
    </div>
    </FadeIn>
  );
}
