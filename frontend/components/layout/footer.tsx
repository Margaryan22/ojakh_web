import Link from 'next/link';
import { Instagram, Send } from 'lucide-react';
import { GoldDivider } from '@/components/editorial/gold-divider';

const ICON_STROKE = 1.5;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className='bg-background border-t border-gold/40'>
      <div className='max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20'>
        <div className='grid md:grid-cols-3 gap-12 md:gap-8'>
          {/* Brand */}
          <div className='space-y-4'>
            <Link
              href='/'
              className='inline-block font-display text-2xl uppercase tracking-[0.22em] hover:text-primary transition-colors'
            >
              Ojakh
            </Link>
            <p className='font-display italic text-base text-muted-foreground max-w-xs leading-relaxed'>
              Очаг&nbsp;— место, где рождается дом. Домашняя кухня
              из&nbsp;Нижнего&nbsp;Новгорода.
            </p>
          </div>

          {/* Nav */}
          <div className='space-y-4'>
            <p className='font-mono text-[10px] uppercase tracking-[0.3em] text-gold'>
              Навигация
            </p>
            <ul className='space-y-2.5'>
              <li>
                <Link
                  href='/catalog'
                  className='font-display text-sm uppercase tracking-[0.15em] hover:text-primary transition-colors'
                >
                  Каталог
                </Link>
              </li>
              <li>
                <Link
                  href='/cart'
                  className='font-display text-sm uppercase tracking-[0.15em] hover:text-primary transition-colors'
                >
                  Корзина
                </Link>
              </li>
              <li>
                <Link
                  href='/orders'
                  className='font-display text-sm uppercase tracking-[0.15em] hover:text-primary transition-colors'
                >
                  Заказы
                </Link>
              </li>
              <li>
                <Link
                  href='/favorites'
                  className='font-display text-sm uppercase tracking-[0.15em] hover:text-primary transition-colors'
                >
                  Избранное
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacts */}
          <div className='space-y-4'>
            <p className='font-mono text-[10px] uppercase tracking-[0.3em] text-gold'>
              Контакты
            </p>
            <ul className='space-y-2.5 text-sm text-foreground/85'>
              <li>Нижний Новгород</li>
              <li className='text-muted-foreground'>
                Доставка ежедневно <br /> 10:00 — 22:00
              </li>
            </ul>
            <div className='flex items-center gap-3 pt-2'>
              <a
                href='https://www.instagram.com/'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Instagram'
                className='inline-flex h-9 w-9 items-center justify-center border border-gold/60 hover:border-foreground hover:bg-gold/10 transition-colors'
              >
                <Instagram className='h-4 w-4' strokeWidth={ICON_STROKE} />
              </a>
              <a
                href='https://t.me/'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Telegram'
                className='inline-flex h-9 w-9 items-center justify-center border border-gold/60 hover:border-foreground hover:bg-gold/10 transition-colors'
              >
                <Send className='h-4 w-4' strokeWidth={ICON_STROKE} />
              </a>
            </div>
          </div>
        </div>

        <div className='mt-16 pt-8'>
          <GoldDivider />
          <div className='pt-6 flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground'>
            <span>© {year} Ojakh</span>
            <span>Домашние полуфабрикаты · Торты · Десерты</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
