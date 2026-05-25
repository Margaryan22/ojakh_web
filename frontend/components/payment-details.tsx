'use client';

import { useState } from 'react';
import { Copy, Check, CreditCard, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Field {
  label: string;
  value: string;
  copyValue?: string;
}

const RECIPIENT_FIELDS: Field[] = [
  { label: 'Получатель', value: 'Костанян Нина Костановна' },
  { label: 'Номер счёта', value: '40817810400107805327' },
  {
    label: 'Назначение платежа',
    value:
      'Перевод средств по договору № 5393318558 Костанян Нина Костановна НДС не облагается',
  },
  { label: 'БИК', value: '044525974' },
  { label: 'Банк-получатель', value: 'АО «ТБанк»' },
  { label: 'Корр. счёт', value: '30101810145250000974' },
  { label: 'ИНН (при необходимости)', value: '7710140679' },
  { label: 'КПП (при необходимости)', value: '771301001' },
];

const PHONE_DISPLAY = '+7 (904) 059-23-03';
const PHONE_COPY = '+79040592303';

function FieldRow({ field }: { field: Field }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(field.copyValue ?? field.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard might be unavailable (insecure context) — fail silently
    }
  };

  return (
    <div className='flex items-start justify-between gap-3 py-2'>
      <div className='min-w-0 flex-1'>
        <p className='text-xs uppercase tracking-wide text-muted-foreground'>
          {field.label}
        </p>
        <p className='mt-0.5 text-sm font-medium break-words'>{field.value}</p>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground'
        onClick={handleCopy}
        aria-label={`Скопировать ${field.label}`}
      >
        {copied ? (
          <Check className='h-4 w-4 text-success' />
        ) : (
          <Copy className='h-4 w-4' />
        )}
      </Button>
    </div>
  );
}

interface PaymentDetailsProps {
  className?: string;
  title?: string;
  intro?: string;
}

export function PaymentDetails({
  className,
  title = 'Реквизиты для оплаты',
  intro = 'Переведите сумму заказа по одному из вариантов ниже. После перевода нажмите «Оплатить», чтобы подтвердить оплату.',
}: PaymentDetailsProps) {
  const [phoneCopied, setPhoneCopied] = useState(false);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(PHONE_COPY);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Card className={cn('border-primary/30 bg-accent/30', className)}>
      <CardHeader className='pb-3'>
        <CardTitle className='text-lg flex items-center gap-2'>
          <CreditCard className='h-5 w-5 text-primary' />
          {title}
        </CardTitle>
        {intro && (
          <p className='text-sm text-muted-foreground'>{intro}</p>
        )}
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Quick option: by phone */}
        <div className='rounded-lg border border-primary/40 bg-card p-3'>
          <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2 min-w-0'>
              <Smartphone className='h-4 w-4 shrink-0 text-primary' />
              <div className='min-w-0'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>
                  Перевод по номеру телефона · Т‑Банк
                </p>
                <p className='mt-0.5 text-base font-semibold tabular-nums'>
                  {PHONE_DISPLAY}
                </p>
              </div>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='shrink-0 gap-1.5'
              onClick={copyPhone}
            >
              {phoneCopied ? (
                <>
                  <Check className='h-3.5 w-3.5 text-success' />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className='h-3.5 w-3.5' />
                  Копировать
                </>
              )}
            </Button>
          </div>
          <p className='mt-1.5 text-xs text-muted-foreground'>
            Получатель: <span className='font-medium text-foreground'>Костанян Нина К.</span>
          </p>
        </div>

        <div className='flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground'>
          <Separator className='flex-1' />
          либо по реквизитам
          <Separator className='flex-1' />
        </div>

        {/* Bank requisites */}
        <div className='rounded-lg border border-border bg-card divide-y divide-border/70 px-3'>
          {RECIPIENT_FIELDS.map((f) => (
            <FieldRow key={f.label} field={f} />
          ))}
        </div>

        <p className='text-xs text-muted-foreground'>
          После перевода нажмите кнопку «Оплатить» ниже — мы проверим поступление средств и переведём заказ в работу.
        </p>
      </CardContent>
    </Card>
  );
}
