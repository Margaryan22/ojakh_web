'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Ornament } from '@/components/brand/ornament';

const CONTACT_PHONE_DISPLAY = '+7 (904) 059-23-03';
const CONTACT_PHONE_HREF = '+79040592303';
const CONTACT_EMAIL = 'sargismargaryan0605@gmail.com';

export function Footer() {
  const [open, setOpen] = useState(false);

  return (
    <footer className='border-t bg-background'>
      <div className='max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground'>
        <p className='flex items-center justify-center gap-2 text-center sm:justify-start sm:text-left'>
          <Ornament className='h-3.5 w-3.5 shrink-0 text-gold' />
          Оджах {new Date().getFullYear()} &mdash; Домашние полуфабрикаты, торты и десерты. Нижний Новгород.
        </p>
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-accent'
        >
          <MessageSquarePlus className='h-4 w-4' />
          Предложить идею
        </button>
      </div>
      <div className='border-t'>
        <div className='max-w-7xl mx-auto px-4 py-4 space-y-1 text-center text-xs text-muted-foreground sm:text-left'>
          <p>Самозанятый Маргарян Саргис Жирайрович · ИНН 524508763158</p>
          <p>Адрес: 603053, г. Нижний Новгород, ул. Мельникова, 29А</p>
          <p>
            Телефон:{' '}
            <a href={`tel:+${CONTACT_PHONE_HREF}`} className='transition-colors hover:text-foreground'>
              {CONTACT_PHONE_DISPLAY}
            </a>
          </p>
          <p>
            E-mail:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className='transition-colors hover:text-foreground'>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </footer>
  );
}
