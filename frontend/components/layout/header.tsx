'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GoldBurst } from '@/components/editorial/gold-burst';
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
  delivery_ordered: 'Едет к вам',
  completed: 'Доставлен',
  cancelled: 'Отменён',
};

const ICON_STROKE = 1.5;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
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
      const interval = setInterval(fetchNotifications, POLLING_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleNotifClick = (id: number, orderId: number) => {
    markOneRead(id);
    setNotifOpen(false);
    setMobileOpen(false);
    router.push(`/orders/${orderId}`);
  };

  const NotificationsPanel = () => (
    <div className='flex flex-col'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-border'>
        <span className='text-sm font-display'>Уведомления</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className='flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors'
          >
            <CheckCheck className='h-3.5 w-3.5' strokeWidth={ICON_STROKE} />
            Прочитать все
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className='px-3 py-4 text-sm text-muted-foreground text-center'>
          Нет уведомлений
        </p>
      ) : (
        <div
          data-lenis-prevent
          className='max-h-72 overflow-y-auto divide-y divide-border'
        >
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
                  <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold' />
                )}
                <div className={cn(!n.isRead ? '' : 'pl-4')}>
                  <p className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5'>
                    Заказ #{n.orderId} · {NOTIFICATION_LABELS[n.status] ?? n.status}
                  </p>
                  <p className='text-foreground leading-snug'>{n.message}</p>
                  <p className='text-[11px] text-muted-foreground mt-1 font-mono'>
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
    <header className='sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-gold/40'>
      <div className='max-w-7xl mx-auto px-4 md:px-8 flex h-20 items-center justify-between'>
        {/* Logo */}
        <Link
          href='/'
          className='flex items-center gap-2 font-display text-xl md:text-2xl uppercase tracking-[0.22em] text-foreground hover:text-primary transition-colors'
        >
          <span>Ojakh</span>
        </Link>

        {/* Desktop nav */}
        <nav className='hidden md:flex items-center gap-8'>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative font-display text-sm uppercase tracking-[0.18em] py-1.5 transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
                {link.href === '/cart' && cartCount > 0 && (
                  <span className='ml-1.5 inline-block h-1 w-1 rounded-full bg-gold align-middle' />
                )}
                {isActive && (
                  <motion.span
                    layoutId='nav-underline'
                    className='absolute left-0 right-0 -bottom-0.5 h-px bg-gold'
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop right */}
        <div className='hidden md:flex items-center gap-3'>
          {user && (
            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='relative'>
                  <Bell className='h-5 w-5' strokeWidth={ICON_STROKE} />
                  {unreadCount > 0 && (
                    <span className='absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-gold bg-background text-[10px] font-mono text-gold'>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-80 p-0'>
                <NotificationsPanel />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Cart icon with gold-burst */}
          <Link
            href='/cart'
            className='relative inline-flex h-9 w-9 items-center justify-center hover:text-primary transition-colors'
            aria-label='Корзина'
          >
            <ShoppingCart className='h-5 w-5' strokeWidth={ICON_STROKE} />
            {cartCount > 0 && (
              <span className='absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-gold bg-background text-[10px] font-mono text-gold'>
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
            <GoldBurst trigger={cartCount} />
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='sm' className='gap-2 font-display text-xs uppercase tracking-wider'>
                  <User className='h-4 w-4' strokeWidth={ICON_STROKE} />
                  {user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-52'>
                <DropdownMenuLabel className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')} className='cursor-pointer'>
                  <User className='mr-2 h-4 w-4' strokeWidth={ICON_STROKE} />
                  Профиль
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/favorites')} className='cursor-pointer'>
                  <Heart className='mr-2 h-4 w-4' strokeWidth={ICON_STROKE} />
                  Избранное
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/orders')} className='cursor-pointer'>
                  <ClipboardList className='mr-2 h-4 w-4' strokeWidth={ICON_STROKE} />
                  Мои заказы
                </DropdownMenuItem>
                {user.role === ADMIN_ROLE && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/admin')} className='cursor-pointer'>
                      <ShieldCheck className='mr-2 h-4 w-4' strokeWidth={ICON_STROKE} />
                      Админ-панель
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className='cursor-pointer'>
                  <LogOut className='mr-2 h-4 w-4' strokeWidth={ICON_STROKE} />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className='flex items-center gap-2'>
              <Button variant='ghost' size='sm' asChild>
                <Link href='/login' className='font-display text-xs uppercase tracking-wider'>Войти</Link>
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
              variant='ghost'
              size='icon'
              className='relative'
              onClick={() => {
                setNotifOpen((v) => !v);
                setMobileOpen(false);
              }}
            >
              <Bell className='h-5 w-5' strokeWidth={ICON_STROKE} />
              {unreadCount > 0 && (
                <span className='absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-gold bg-background text-[10px] font-mono text-gold'>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          )}
          <Button variant='ghost' size='icon' asChild>
            <Link href='/cart' className='relative'>
              <ShoppingCart className='h-5 w-5' strokeWidth={ICON_STROKE} />
              {cartCount > 0 && (
                <span className='absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-gold' />
              )}
              <GoldBurst trigger={cartCount} />
            </Link>
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => {
              setMobileOpen((v) => !v);
              setNotifOpen(false);
            }}
          >
            {mobileOpen ? <X className='h-5 w-5' strokeWidth={ICON_STROKE} /> : <Menu className='h-5 w-5' strokeWidth={ICON_STROKE} />}
          </Button>
        </div>
      </div>

      {/* Mobile notifications panel */}
      {notifOpen && user && (
        <div className='md:hidden border-t border-border bg-background'>
          <div className='max-w-7xl mx-auto'>
            <NotificationsPanel />
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className='md:hidden border-t border-border bg-background'>
          <nav className='max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1'>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'font-display uppercase tracking-[0.18em] text-sm px-3 py-3 transition-colors border-b border-border last:border-b-0',
                  pathname === link.href
                    ? 'text-foreground border-gold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className='border-t border-border my-2' />
            {user ? (
              <>
                <Link
                  href='/profile'
                  onClick={() => setMobileOpen(false)}
                  className='flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground'
                >
                  <User className='h-4 w-4' strokeWidth={ICON_STROKE} />
                  Профиль
                </Link>
                <Link
                  href='/favorites'
                  onClick={() => setMobileOpen(false)}
                  className='flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground'
                >
                  <Heart className='h-4 w-4' strokeWidth={ICON_STROKE} />
                  Избранное
                </Link>
                {user.role === ADMIN_ROLE && (
                  <Link
                    href='/admin'
                    onClick={() => setMobileOpen(false)}
                    className='flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground'
                  >
                    <ShieldCheck className='h-4 w-4' strokeWidth={ICON_STROKE} />
                    Админ-панель
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileOpen(false);
                  }}
                  className='flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground w-full text-left cursor-pointer'
                >
                  <LogOut className='h-4 w-4' strokeWidth={ICON_STROKE} />
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link
                  href='/login'
                  onClick={() => setMobileOpen(false)}
                  className='px-3 py-2 text-sm text-muted-foreground hover:text-foreground'
                >
                  Войти
                </Link>
                <Link
                  href='/register'
                  onClick={() => setMobileOpen(false)}
                  className='px-3 py-2 text-sm text-primary hover:text-foreground'
                >
                  Регистрация
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
