'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Menu,
  X,
  ShoppingCart,
  User,
  LogOut,
  ClipboardList,
  ShieldCheck,
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
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/cart', label: 'Корзина' },
  { href: '/orders', label: 'Заказы' },
];

const STATUS_LABELS: Record<string, string> = {
  preparing: 'Готовится',
  ready: 'Готов',
  delivery_ordered: 'Едет к вам',
  completed: 'Доставлен',
  cancelled: 'Отменён',
};

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
      // Poll every 30s
      const interval = setInterval(fetchNotifications, 30_000);
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
                    Заказ #{n.orderId} · {STATUS_LABELS[n.status] ?? n.status}
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
        <Link href='/catalog' className='flex items-center group'>
          <div className='relative h-11 w-44'>
            <Image
              src='/logo-dark.jpg'
              alt='Оджах'
              fill
              className='object-contain transition-opacity group-hover:opacity-0'
              priority
            />
            <Image
              src='/logo-light.jpg'
              alt='Оджах'
              fill
              className='object-contain opacity-0 transition-opacity group-hover:opacity-100'
              priority
            />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className='hidden md:flex items-center gap-6'>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === link.href ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {link.label}
              {link.href === '/cart' && cartCount > 0 && (
                <span className='ml-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle' />
              )}
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
                  {unreadCount > 0 && (
                    <span className='absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'>
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
                {user.role === 'admin' && (
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
              {cartCount > 0 && (
                <span className='absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary' />
              )}
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
            {mobileOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
          </Button>
        </div>
      </div>

      {/* Mobile notifications panel */}
      {notifOpen && user && (
        <div className='md:hidden border-t bg-background'>
          <div className='max-w-7xl mx-auto'>
            <NotificationsPanel />
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className='md:hidden border-t bg-background'>
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
                  <Image src='/ornament-fav-off.jpg' alt='' width={16} height={16} className='rounded-full' />
                  Избранное
                </Link>
                {user.role === 'admin' && (
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
        </div>
      )}
    </header>
  );
}
