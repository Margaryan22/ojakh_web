'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Truck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, formatDateFull } from '@/lib/format';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  WAREHOUSE_ADDRESS,
  YANDEX_CLAIM_STATUS_LABELS,
} from '@/lib/constants';
import { usePaymentConfig, usePaymentFlow } from '@/lib/use-payment';
import { YookassaWidget } from '@/components/yookassa-widget';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import { DUR_BASE, EASE_OUT } from '@/components/motion/motion-presets';
import { AnimatePresence, motion } from 'framer-motion';
import { OrderChat } from '@/components/order-chat';
import { PaymentDetails } from '@/components/payment-details';
import type { Order, OrderStatus, DeliveryQuote, DeliveryClaimResponse } from '@/types';
import { useState } from 'react';
import { AxiosError } from 'axios';

const ACTIVE_CLAIM_STATUSES: OrderStatus[] = [
  'awaiting_payment_for_courier',
  'delivering',
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isPaying, setIsPaying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isCreatingClaim, setIsCreatingClaim] = useState(false);
  const [isPayingDoplata, setIsPayingDoplata] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const fetchCart = useCartStore((s) => s.fetchCart);

  const orderId = params.id as string;

  const { data: order, isLoading, refetch } = useQuery<Order>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}`);
      return data;
    },
    enabled: !!user && !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as OrderStatus | undefined;
      if (!status) return false;
      return ACTIVE_CLAIM_STATUSES.includes(status) ? 15_000 : false;
    },
  });

  const { data: paymentConfig } = usePaymentConfig();
  const provider = paymentConfig?.provider ?? 'manual';

  const mainPayment = usePaymentFlow({
    orderId: Number(orderId),
    kind: 'main',
    onSucceeded: () => {
      toast.success('Оплата прошла успешно');
      refetch();
    },
    onCanceled: () => {
      toast.error('Платёж отменён. Попробуйте оплатить ещё раз.');
    },
  });

  const doplataPayment = usePaymentFlow({
    orderId: Number(orderId),
    kind: 'doplata',
    onSucceeded: () => {
      toast.success('Заказ передан в доставку');
      setQuote(null);
      refetch();
    },
    onCanceled: () => {
      toast.error('Платёж отменён. Попробуйте оплатить ещё раз.');
    },
  });

  const handleCancel = async () => {
    if (!confirm('Вы уверены, что хотите отменить заказ?')) return;
    setIsCancelling(true);
    try {
      await api.patch(`/orders/${orderId}/cancel`);
      toast.success('Заказ отменён');
      refetch();
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка отмены заказа');
      } else {
        toast.error('Ошибка отмены заказа');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReorder = async () => {
    setIsReordering(true);
    try {
      const { data } = await api.post(`/orders/${orderId}/reorder`);
      await fetchCart();
      const added: number = data.added ?? 0;
      const skipped: string[] = data.skipped ?? [];
      if (added === 0) {
        toast.error('Товары из этого заказа сейчас недоступны');
        return;
      }
      if (skipped.length > 0) {
        toast.success(
          `Добавлено в корзину. Недоступно сейчас: ${skipped.join(', ')}`,
        );
      } else {
        toast.success('Товары добавлены в корзину');
      }
      router.push('/cart');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось повторить заказ');
      } else {
        toast.error('Не удалось повторить заказ');
      }
    } finally {
      setIsReordering(false);
    }
  };

  const handlePay = async () => {
    setIsPaying(true);
    try {
      if (provider === 'yookassa') {
        // Платёж создан — виджет отрисуется по confirmation_token
        await mainPayment.start();
      } else {
        const payment = await mainPayment.start();
        await api.post(`/payments/confirm/${payment.payment_id}`);
        toast.success('Оплата прошла успешно');
        refetch();
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка оплаты');
      } else {
        toast.error('Ошибка оплаты');
      }
    } finally {
      setIsPaying(false);
    }
  };

  // Доплата за курьера: создаёт платёж; для ЮKassa откроется диалог
  // с виджетом, для manual — сразу подтверждаем перевод по реквизитам.
  const handlePayDoplata = async () => {
    setIsPayingDoplata(true);
    try {
      const payment = await doplataPayment.start();
      if (provider !== 'yookassa') {
        await api.post(`/payments/confirm/${payment.payment_id}`);
        toast.success('Заказ передан в доставку');
        setQuote(null);
        refetch();
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка оплаты доплаты');
      } else {
        toast.error('Ошибка оплаты доплаты');
      }
    } finally {
      setIsPayingDoplata(false);
    }
  };

  const handleRequestQuote = async () => {
    setIsQuoting(true);
    try {
      const { data } = await api.post<DeliveryQuote>(`/orders/${orderId}/delivery-quote`);
      setQuote(data);
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось получить расчёт');
      } else {
        toast.error('Не удалось получить расчёт');
      }
    } finally {
      setIsQuoting(false);
    }
  };

  const handleConfirmClaim = async () => {
    if (!quote) return;
    setIsCreatingClaim(true);
    try {
      const { data } = await api.post<DeliveryClaimResponse>(
        `/orders/${orderId}/delivery-claim`,
        { recalcId: quote.recalcId },
      );
      if (data.status === 'awaiting_payment') {
        toast.message('Оплатите доплату за доставку');
        await handlePayDoplata();
        refetch();
      } else {
        toast.success('Заказ передан в доставку');
        setQuote(null);
        refetch();
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось оформить доставку');
        if (error.response?.status === 410) {
          setQuote(null);
        }
      } else {
        toast.error('Не удалось оформить доставку');
      }
    } finally {
      setIsCreatingClaim(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <Button onClick={() => router.push('/login')}>Войти</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Заказ не найден</p>
      </div>
    );
  }

  const canCallCourier =
    order.status === 'ready' && !order.isPickup && !order.dispatchedAt;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <FadeIn>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Заказ #{order.orderNumber ?? order.id}</h1>
        <Badge className={STATUS_COLORS[order.status as OrderStatus]}>
          {STATUS_LABELS[order.status as OrderStatus]}
        </Badge>
      </div>
      </FadeIn>

      <StaggerContainer immediate className="space-y-6">
      <StaggerItem>
      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Состав заказа</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span>
                {item.name}
                {item.flavor ? ` (${item.flavor})` : ''}
                {item.size ? ` ${item.size}` : ''}
                {' '}&times; {item.quantity} {item.unit}
              </span>
              <span className="font-medium">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
          <Separator />
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Товары:</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.deliveryCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Доставка:</span>
                <span>{formatPrice(order.deliveryCost)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Итого:</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </StaggerItem>

      <StaggerItem>
      {/* Delivery info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Доставка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Тип:</span>{' '}
            {order.isPickup ? 'Самовывоз' : 'Доставка'}
          </p>
          {order.address && (
            <p>
              <span className="text-muted-foreground">Адрес:</span> {order.address}
            </p>
          )}
          {order.isPickup && (
            <p>
              <span className="text-muted-foreground">Адрес самовывоза:</span>{' '}
              {WAREHOUSE_ADDRESS}
            </p>
          )}
          {order.recipientName && (
            <p>
              <span className="text-muted-foreground">Получатель:</span> {order.recipientName}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Дата:</span>{' '}
            {formatDateFull(order.deliveryDate)}
          </p>
          {order.deliveryTime && (
            <p>
              <span className="text-muted-foreground">Время:</span> {order.deliveryTime}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Создан:</span>{' '}
            {formatDateFull(order.createdAt)}
          </p>
          {order.paidAt && (
            <p>
              <span className="text-muted-foreground">Оплачен:</span>{' '}
              {formatDateFull(order.paidAt)}
            </p>
          )}
          {order.dispatchedAt && (
            <p className="pt-1 border-t">
              <span className="text-muted-foreground">Статус доставки:</span>{' '}
              <span className="font-medium">
                {STATUS_LABELS[order.status as OrderStatus]}
              </span>
            </p>
          )}
          {order.yandexClaimStatus && YANDEX_CLAIM_STATUS_LABELS[order.yandexClaimStatus] && (
            <p>
              <span className="text-muted-foreground">Курьер:</span>{' '}
              <span className="font-medium">
                {YANDEX_CLAIM_STATUS_LABELS[order.yandexClaimStatus]}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
      </StaggerItem>

      <StaggerItem>
        <OrderChat orderId={order.id} role="user" />
      </StaggerItem>
      </StaggerContainer>

      {/* Payment for new orders: YooKassa widget or manual requisites */}
      {order.status === 'new' && provider === 'yookassa' && (
        mainPayment.payment?.confirmation_token ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Оплата заказа</CardTitle>
            </CardHeader>
            <CardContent>
              <YookassaWidget
                confirmationToken={mainPayment.payment.confirmation_token}
                onSuccess={mainPayment.settleFromWidget}
                onFail={() => {
                  toast.error('Не удалось выполнить оплату. Попробуйте ещё раз.');
                  mainPayment.reset();
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Button
            className="w-full"
            size="lg"
            onClick={handlePay}
            disabled={isPaying || mainPayment.isCreating}
          >
            {isPaying || mainPayment.isCreating
              ? 'Готовим оплату...'
              : `Оплатить ${formatPrice(order.total)}`}
          </Button>
        )
      )}
      {order.status === 'new' && provider === 'manual' && (
        <>
          <PaymentDetails
            intro={`Сумма к оплате: ${formatPrice(order.total)}. Переведите её по одному из вариантов ниже, а затем подтвердите оплату кнопкой «Оплатить».`}
          />
          <Button
            className="w-full"
            size="lg"
            onClick={handlePay}
            disabled={isPaying}
          >
            {isPaying ? 'Оплата...' : `Оплатить ${formatPrice(order.total)}`}
          </Button>
        </>
      )}

      {/* Doplata for courier when user returns to the page later */}
      {order.status === 'awaiting_payment_for_courier' &&
        (order.deliverySurchargeKopecks ?? 0) > 0 &&
        !doplataPayment.payment && (
          <Button
            className="w-full"
            size="lg"
            onClick={handlePayDoplata}
            disabled={isPayingDoplata || doplataPayment.isCreating}
          >
            {isPayingDoplata || doplataPayment.isCreating
              ? 'Готовим оплату...'
              : `Доплатить ${formatPrice(order.deliverySurchargeKopecks!)} за доставку`}
          </Button>
        )}

      {/* Cancel button for new (unpaid) orders */}
      {order.status === 'new' && (
        <Button
          variant="destructive"
          className="w-full"
          size="lg"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? 'Отмена...' : 'Отменить заказ'}
        </Button>
      )}

      {/* Reorder — повторить прошлый заказ (кроме ещё не оплаченного new) */}
      {order.status !== 'new' && (
        <Button
          variant="outline"
          className="w-full gap-2"
          size="lg"
          onClick={handleReorder}
          disabled={isReordering}
        >
          <RotateCcw className="h-4 w-4" />
          {isReordering ? 'Добавляем...' : 'Заказать снова'}
        </Button>
      )}

      <AnimatePresence mode="wait">
      {/* Dispatch button — only when ready, delivery, not yet dispatched */}
      {canCallCourier && !quote && (
        <motion.div
          key="dispatch-cta"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: DUR_BASE, ease: EASE_OUT }}
          className="overflow-hidden"
        >
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={handleRequestQuote}
          disabled={isQuoting}
        >
          <Truck className="h-4 w-4" />
          {isQuoting ? 'Считаем стоимость...' : 'Оформить доставку'}
        </Button>
        </motion.div>
      )}

      {/* Quote confirmation card */}
      {canCallCourier && quote && (
        <motion.div
          key="dispatch-quote"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: DUR_BASE, ease: EASE_OUT }}
          className="overflow-hidden"
        >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Подтверждение доставки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Актуальная цена доставки:</span>
              <span className="font-medium">{formatPrice(quote.priceKopecks)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Оплачено в заказе:</span>
              <span>{formatPrice(order.deliveryCost)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Доплата:</span>
              <span>
                {quote.surchargeKopecks > 0 ? formatPrice(quote.surchargeKopecks) : 'не требуется'}
              </span>
            </div>
            {quote.surchargeKopecks > 0 && (
              <p className="text-xs text-muted-foreground">
                После подтверждения мы спишем доплату и сразу передадим заказ в доставку.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleConfirmClaim}
                disabled={isCreatingClaim || isPayingDoplata}
              >
                {isCreatingClaim || isPayingDoplata
                  ? 'Оформляем...'
                  : quote.surchargeKopecks > 0
                    ? `Доплатить ${formatPrice(quote.surchargeKopecks)} и передать в доставку`
                    : 'Передать в доставку'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setQuote(null)}
                disabled={isCreatingClaim || isPayingDoplata}
              >
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>

      {/* YooKassa widget for courier surcharge */}
      <Dialog
        open={!!doplataPayment.payment?.confirmation_token}
        onOpenChange={(open) => {
          if (!open) doplataPayment.reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Доплата за доставку</DialogTitle>
          </DialogHeader>
          {doplataPayment.payment?.confirmation_token && (
            <YookassaWidget
              confirmationToken={doplataPayment.payment.confirmation_token}
              onSuccess={doplataPayment.settleFromWidget}
              onFail={() => {
                toast.error('Не удалось выполнить оплату. Попробуйте ещё раз.');
                doplataPayment.reset();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
