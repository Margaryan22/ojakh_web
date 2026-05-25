'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackDialog } from '@/components/feedback-dialog';

export function Footer() {
  const [open, setOpen] = useState(false);

  return (
    <footer className='border-t bg-background'>
      <div className='max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground'>
        <p className='text-center sm:text-left'>
          Ojakh {new Date().getFullYear()} &mdash; Домашние полуфабрикаты, торты и десерты. Нижний Новгород.
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
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </footer>
  );
}
