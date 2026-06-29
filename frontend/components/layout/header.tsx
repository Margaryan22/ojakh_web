'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu,
  X,
  ShoppingCart,
  User,
  LogOut,
  ClipboardList,
  ShieldCheck,
  Heart,
  Bell,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DUR_BASE, DUR_FAST, EASE_OUT } from '@/components/motion/motion-presets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { cn } from '@/lib/utils';
import { ADMIN_ROLE, POLLING_INTERVAL_MS } from '@/lib/constants';

const navLinks = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/cart', label: 'Корзина' },
  { href: '/orders', label: 'Заказы' },
];

const NOTIFICATION_LABELS: Record<string, string> = {
  preparing: 'Готовится',
  ready: 'Готов',
  awaiting_payment_for_courier: 'Нужна доплата',
  delivering: 'В доставке',
  completed: 'Доставлен',
  cancelled: 'Отменён',
  payment_expired: 'Время оплаты истекло',
  broadcast: 'Объявление',
};

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const burgerBtnRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const totalItems = useCartStore((s) => s.totalItems);
  const cartCount = totalItems();
  const { items: notifications, fetch: fetchNotifications, markAllRead, markOneRead } = useNotificationsStore();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll every 30s
      const interval = setInterval(fetchNotifications, POLLING_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  // На мобиле закрываем выпадающие панели шапки (бургер-меню и уведомления)
  // при клике вне них и при скролле страницы. Слушатели висят, только пока
  // что-то открыто. Панель уведомлений на десктопе — это Radix DropdownMenu,
  // он закрывается сам, поэтому ручное закрытие включаем только для мобилы.
  useEffect(() => {
    if (!mobileOpen && !notifOpen) return;

    const isMobile = () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches;

    const handlePointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // Бургер-меню (рендерится только на мобиле): клик по меню или по бургеру
      // не закрывает — бургер тогглит сам.
      if (
        mobileOpen &&
        !mobileMenuRef.current?.contains(t) &&
        !burgerBtnRef.current?.contains(t)
      ) {
        setMobileOpen(false);
      }
      if (
        notifOpen &&
        isMobile() &&
        !notifPanelRef.current?.contains(t) &&
        !notifBtnRef.current?.contains(t)
      ) {
        setNotifOpen(false);
      }
    };
    const handleScroll = () => {
      setMobileOpen(false);
      if (isMobile()) setNotifOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mobileOpen, notifOpen]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleNotifClick = (id: number, orderId: number | null) => {
    markOneRead(id);
    setNotifOpen(false);
    setMobileOpen(false);
    // Объявления (broadcast) не привязаны к заказу — никуда не переходим.
    if (orderId != null) router.push(`/orders/${orderId}`);
  };

  const NotificationsPanel = () => (
    <div className='flex flex-col'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-border'>
        <span className='text-sm font-semibold'>Уведомления</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className='flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors'
          >
            <CheckCheck className='h-3.5 w-3.5' />
            Прочитать все
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className='px-3 py-4 text-sm text-muted-foreground text-center'>
          Нет уведомлений
        </p>
      ) : (
        <div className='max-h-72 overflow-y-auto divide-y divide-border'>
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleNotifClick(n.id, n.orderId)}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors',
                !n.isRead && 'bg-accent/50',
              )}
            >
              <div className='flex items-start gap-2'>
                {!n.isRead && (
                  <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary' />
                )}
                <div className={cn(!n.isRead ? '' : 'pl-4')}>
                  <p className='font-medium text-xs text-muted-foreground mb-0.5'>
                    {n.orderId != null
                      ? `Заказ #${n.orderId} · ${NOTIFICATION_LABELS[n.status] ?? n.status}`
                      : (NOTIFICATION_LABELS[n.status] ?? n.status)}
                  </p>
                  <p className='text-foreground leading-snug'>{n.message}</p>
                  <p className='text-[11px] text-muted-foreground mt-1'>
                    {new Date(n.createdAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className='sticky top-0 z-40 w-full bg-background shadow-sm border-b border-border'>
      <div className='max-w-7xl mx-auto px-4 flex h-16 items-center justify-between'>
        {/* Logo */}
        <Link
          href='/catalog'
          className='flex items-center gap-2 font-bold text-2xl text-primary transition-opacity duration-200 hover:opacity-80'
        >
          <motion.span
            whileHover={{ scale: 1.03 }}
            transition={{ duration: DUR_FAST, ease: EASE_OUT }}
            style={{ fontFamily: "'Comic Relief', system-ui, sans-serif", fontWeight: '700' }}
          >
            Ojakh
          </motion.span>
        </Link>

        {/* Desktop nav */}
        <nav className='hidden md:flex items-center gap-6'>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'group relative text-sm font-medium transition-colors duration-200 hover:text-primary py-1',
                pathname === link.href ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {link.label}
              {link.href === '/cart' && cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: DUR_FAST, ease: EASE_OUT }}
                  className='ml-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle'
                />
              )}
              <span
                className={cn(
                  'pointer-events-none absolute left-0 right-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-primary transition-transform duration-200 ease-out-soft',
                  pathname === link.href ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                )}
              />
            </Link>
          ))}
        </nav>

        {/* Desktop right */}
        <div className='hidden md:flex items-center gap-2'>
          {user && (
            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='relative'>
                  <Bell className='h-5 w-5' />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span
                        key={unreadCount}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: DUR_FAST, ease: EASE_OUT }}
                        className='absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-80 p-0'>
                <NotificationsPanel />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='sm' className='gap-2'>
                  <User className='h-4 w-4' />
                  {user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')} className='cursor-pointer'>
                  <User className='mr-2 h-4 w-4' />
                  Профиль
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/favorites')} className='cursor-pointer'>
                  <Image src='/ornament-fav-off.jpg' alt='' width={16} height={16} className='mr-2 rounded-full' />
                  Избранное
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/orders')} className='cursor-pointer'>
                  <ClipboardList className='mr-2 h-4 w-4' />
                  Мои заказы
                </DropdownMenuItem>
                {user.role === ADMIN_ROLE && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/admin')} className='cursor-pointer'>
                      <ShieldCheck className='mr-2 h-4 w-4' />
                      Админ-панель
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className='cursor-pointer'>
                  <LogOut className='mr-2 h-4 w-4' />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className='flex items-center gap-2'>
              <Button variant='ghost' size='sm' asChild>
                <Link href='/login'>Войти</Link>
              </Button>
              <Button size='sm' asChild>
                <Link href='/register'>Регистрация</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile: cart icon + hamburger */}
        <div className='flex md:hidden items-center gap-1'>
          {user && (
            <Button
              ref={notifBtnRef}
              variant='ghost'
              size='icon'
              className='relative'
              onClick={() => {
                setNotifOpen((v) => !v);
                setMobileOpen(false);
              }}
            >
              <Bell className='h-5 w-5' />
              {unreadCount > 0 && (
                <span className='absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          )}
          <Button variant='ghost' size='icon' asChild>
            <Link href='/cart' className='relative'>
              <ShoppingCart className='h-5 w-5' />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: DUR_FAST, ease: EASE_OUT }}
                    className='absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary'
                  />
                )}
              </AnimatePresence>
            </Link>
          </Button>
          <Button
            ref={burgerBtnRef}
            variant='ghost'
            size='icon'
            onClick={() => {
              setMobileOpen((v) => !v);
              setNotifOpen(false);
            }}
          >
            {mobileOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
          </Button>
        </div>
      </div>

      {/* Mobile notifications panel */}
      {notifOpen && user && (
        <div ref={notifPanelRef} className='md:hidden border-t bg-background'>
          <div className='max-w-7xl mx-auto'>
            <NotificationsPanel />
          </div>
        </div>
      )}

      {/* Mobile menu */}
      <AnimatePresence initial={false}>
      {mobileOpen && (
        <motion.div
          key='mobile-menu'
          ref={mobileMenuRef}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: DUR_BASE, ease: EASE_OUT }}
          className='md:hidden border-t bg-background overflow-hidden'
        >
          <nav className='max-w-7xl mx-auto px-4 py-4 flex flex-col gap-2'>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  pathname === link.href ? 'bg-accent text-primary' : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className='border-t my-2' />
            {user ? (
              <>
                <Link
                  href='/profile'
                  onClick={() => setMobileOpen(false)}
                  className='flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent'
                >
                  <User className='h-4 w-4' />
                  Профиль
                </Link>
                <Link
                  href='/favorites'
                  onClick={() => setMobileOpen(false)}
                  className='flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent'
                >
                  <Heart className='h-4 w-4' />
                  Избранное
                </Link>
                {user.role === ADMIN_ROLE && (
                  <Link
                    href='/admin'
                    onClick={() => setMobileOpen(false)}
                    className='flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent'
                  >
                    <ShieldCheck className='h-4 w-4' />
                    Админ-панель
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileOpen(false);
                  }}
                  className='flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent w-full text-left cursor-pointer'
                >
                  <LogOut className='h-4 w-4' />
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link
                  href='/login'
                  onClick={() => setMobileOpen(false)}
                  className='flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent'
                >
                  Войти
                </Link>
                <Link
                  href='/register'
                  onClick={() => setMobileOpen(false)}
                  className='flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent'
                >
                  Регистрация
                </Link>
              </>
            )}
          </nav>
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  );
}
