'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { ImageMaskReveal } from '@/components/editorial/image-mask-reveal';

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <section className='relative min-h-[85vh] md:min-h-[90vh] flex items-center overflow-hidden'>
      {/* Subtle background texture using radial gradients */}
      <div className='absolute inset-0 -z-10'>
        <div
          aria-hidden
          className='absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(184,149,104,0.08),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(168,70,61,0.06),transparent_50%)]'
        />
      </div>

      <div className='max-w-[1300px] mx-auto px-4 md:px-8 w-full grid md:grid-cols-12 gap-8 md:gap-12 items-center pt-24 pb-16 md:pt-32 md:pb-24'>
        {/* Copy */}
        <div className='md:col-span-7 space-y-8'>
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className='inline-block font-mono text-xs uppercase tracking-[0.3em] text-gold'
          >
            Ojakh · Нижний&nbsp;Новгород
          </motion.span>

          <div className='space-y-5'>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0.2 : 0.9,
                delay: 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className='font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.02] tracking-tight'
            >
              Из&nbsp;нашего <em>очага</em>
            </motion.h1>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: reduced ? 0.2 : 0.9,
                delay: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className='h-px w-32 bg-gold origin-left'
            />

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0.2 : 0.9,
                delay: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              className='font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.02] tracking-tight'
            >
              к&nbsp;вашему&nbsp;столу
            </motion.h1>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className='text-base md:text-lg text-muted-foreground max-w-md leading-relaxed'
          >
            Домашние хинкали, пельмени, блины, хлеб на закваске, торты
            и&nbsp;десерты. Доставка по&nbsp;Нижнему Новгороду на следующий
            день&nbsp;и&nbsp;дальше.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
            className='flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center pt-4'
          >
            <Link
              href='/catalog'
              className='inline-flex items-center gap-3 px-8 py-4 bg-foreground text-background font-display uppercase tracking-[0.18em] text-xs hover:bg-primary transition-colors'
            >
              Открыть каталог
            </Link>
            <Link
              href='#story'
              className='font-display italic text-base gold-underline-hover'
            >
              Узнать об&nbsp;Ojakh
            </Link>
          </motion.div>
        </div>

        {/* Editorial decorative panel */}
        <div className='md:col-span-5 hidden md:block'>
          <ImageMaskReveal delay={0.3} duration={1.4}>
            <div className='relative aspect-[3/4] bg-sand overflow-hidden'>
              {/* Composed decorative panel: emoji + thin gold frame + number */}
              <div className='absolute inset-4 border border-gold/40' />

              <div className='absolute top-8 left-8 font-mono text-xs uppercase tracking-[0.3em] text-gold'>
                №01 — 2026
              </div>

              <div className='absolute inset-0 flex items-center justify-center'>
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 1.2,
                    delay: 1.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className='text-[14rem] leading-none'
                  aria-hidden
                >
                  🥟
                </motion.span>
              </div>

              <div className='absolute bottom-8 right-8 text-right space-y-1'>
                <p className='font-display italic text-lg'>Хинкали</p>
                <p className='font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground'>
                  Главное
                </p>
              </div>
            </div>
          </ImageMaskReveal>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className='absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground'
        aria-hidden
      >
        <span className='font-mono text-[10px] uppercase tracking-[0.3em]'>
          Листать
        </span>
        <ChevronDown className='h-4 w-4 animate-bounce' strokeWidth={1.25} />
      </motion.div>
    </section>
  );
}
