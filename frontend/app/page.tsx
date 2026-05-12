import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { GoldDivider } from '@/components/editorial/gold-divider';
import { EditorialNumber } from '@/components/editorial/editorial-number';
import { Reveal } from '@/components/editorial/reveal';
import { Stagger, StaggerItem } from '@/components/editorial/stagger';
import { Hero } from '@/components/home/hero';

const featuredCategories = [
  {
    slug: 'хинкали',
    title: 'Хинкали',
    descriptor: 'Тбилисский рецепт',
    emoji: '🥟',
  },
  {
    slug: 'торты',
    title: 'Торты',
    descriptor: 'По предзаказу за 2 дня',
    emoji: '🎂',
  },
  {
    slug: 'десерты',
    title: 'Десерты',
    descriptor: 'Свежие, без консервантов',
    emoji: '🍰',
  },
];

export default function HomePage() {
  return (
    <div className='min-h-screen flex flex-col'>
      <Header />

      <main className='flex-1'>
        <Hero />

        {/* Story strip */}
        <section className='max-w-[1100px] mx-auto px-4 md:px-8 py-24 md:py-32 space-y-24'>
          <Reveal>
            <div className='grid md:grid-cols-12 gap-8 md:gap-12 items-start'>
              <div className='md:col-span-2 flex md:block'>
                <EditorialNumber size='lg'>01</EditorialNumber>
              </div>
              <div className='md:col-span-10 space-y-6'>
                <h2 className='font-display text-3xl md:text-5xl leading-tight'>
                  Очаг — это место, <br />
                  где рождается дом
                </h2>
                <GoldDivider align='left' />
                <p className='text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl'>
                  «Օջախ» по‑армянски значит «очаг». Для нас это&nbsp;— тепло,
                  которое перетекает из руки в&nbsp;руку: от&nbsp;нашей кухни
                  к&nbsp;вашему столу. Каждый хинкали слеплен вручную,
                  каждый торт собран в&nbsp;день&nbsp;заказа.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className='grid md:grid-cols-12 gap-8 md:gap-12 items-start'>
              <div className='md:col-span-10 md:order-1 order-2 space-y-6 md:text-right'>
                <h2 className='font-display text-3xl md:text-5xl leading-tight'>
                  Без полок, <br />
                  без морозильных&nbsp;цехов
                </h2>
                <GoldDivider align='left' className='md:ml-auto md:w-16' />
                <p className='text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl md:ml-auto'>
                  Мы готовим небольшими партиями&nbsp;— столько, сколько
                  успеваем&nbsp;съесть сами. Поэтому в&nbsp;каждом заказе вы
                  получаете еду, сделанную для&nbsp;конкретного&nbsp;дня.
                </p>
              </div>
              <div className='md:col-span-2 md:order-2 order-1 flex md:justify-end'>
                <EditorialNumber size='lg'>02</EditorialNumber>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Categories teaser */}
        <section className='bg-sand/40 py-24 md:py-32 border-y border-border'>
          <div className='max-w-[1200px] mx-auto px-4 md:px-8'>
            <Reveal>
              <div className='flex flex-col items-center gap-6 mb-16 md:mb-24 text-center'>
                <span className='font-mono text-xs uppercase tracking-[0.3em] text-gold'>
                  Каталог
                </span>
                <h2 className='font-display text-4xl md:text-6xl leading-tight max-w-2xl'>
                  Что сегодня <em>в&nbsp;печи</em>
                </h2>
                <GoldDivider align='center' withGlyph />
              </div>
            </Reveal>

            <Stagger className='grid md:grid-cols-3 gap-6 md:gap-10'>
              {featuredCategories.map((cat, i) => (
                <StaggerItem key={cat.slug}>
                  <Link
                    href={`/catalog#${cat.slug}`}
                    className='group block relative overflow-hidden bg-sand aspect-[4/5] border border-transparent hover:border-gold transition-colors duration-500'
                  >
                    <div className='absolute inset-0 flex items-center justify-center'>
                      <span className='text-[10rem] md:text-[12rem] opacity-90 transition-transform duration-700 group-hover:scale-105'>
                        {cat.emoji}
                      </span>
                    </div>
                    <div className='absolute top-4 left-4'>
                      <span className='font-mono text-xs text-gold/80'>
                        0{i + 1}
                      </span>
                    </div>
                    <div className='absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/85 to-transparent'>
                      <h3 className='font-display text-2xl md:text-3xl leading-none mb-2'>
                        {cat.title}
                      </h3>
                      <p className='text-sm text-muted-foreground mb-3'>
                        {cat.descriptor}
                      </p>
                      <span className='inline-block gold-underline-hover text-sm tracking-wider uppercase'>
                        Смотреть →
                      </span>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal>
              <div className='flex justify-center mt-16'>
                <Link
                  href='/catalog'
                  className='font-display text-lg uppercase tracking-[0.18em] border-b border-gold pb-1 hover:border-foreground transition-colors'
                >
                  Весь каталог
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Manifesto */}
        <section className='py-24 md:py-40'>
          <div className='max-w-3xl mx-auto px-4 md:px-8 text-center space-y-10'>
            <Reveal>
              <GoldDivider align='center' />
            </Reveal>
            <Reveal delay={0.1}>
              <p className='font-display italic text-2xl md:text-4xl leading-snug'>
                «У каждого дома должен быть свой очаг.
                <br />
                Пусть наш&nbsp;— иногда&nbsp;будет&nbsp;вашим».
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className='font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground'>
                Нижний Новгород · с&nbsp;любовью
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <GoldDivider align='center' />
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
