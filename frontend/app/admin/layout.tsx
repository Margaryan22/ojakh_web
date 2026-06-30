'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Package,
  CalendarDays,
  BarChart2,
  MessageSquare,
  Star,
  Settings,
  Ticket,
  ArrowLeft,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { ADMIN_ROLE } from '@/lib/constants';
import api from '@/lib/api';
import type { AdminUnreadSummary } from '@/types';

type AdminBadge = 'orders' | 'feedback';

const adminLinks: {
  href: string;
  label: string;
  icon: typeof ClipboardList;
  badge: AdminBadge | null;
}[] = [
  { href: '/admin', label: 'Заказы', icon: ClipboardList, badge: 'orders' },
  { href: '/admin/products', label: 'Товары', icon: Package, badge: null },
  { href: '/admin/calendar', label: 'Календарь', icon: CalendarDays, badge: null },
  { href: '/admin/analytics', label: 'Аналитика', icon: BarChart2, badge: null },
  { href: '/admin/reviews', label: 'Отзывы о товарах', icon: Star, badge: null },
  { href: '/admin/feedback', label: 'Обращения', icon: MessageSquare, badge: 'feedback' },
  { href: '/admin/promo', label: 'Промокоды', icon: Ticket, badge: null },
  { href: '/admin/settings', label: 'Настройки', icon: Settings, badge: null },
];

const MUTE_STORAGE_KEY = 'admin-chat-mute';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAdmin = !!user && user.role === ADMIN_ROLE;

  const [muted, setMuted] = useState(false);
  const prevCountRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (isInitialized && (!user || user.role !== ADMIN_ROLE)) {
      router.replace('/catalog');
    }
  }, [user, isInitialized, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(MUTE_STORAGE_KEY);
    setMuted(stored === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  }, [muted]);

  // Prime AudioContext on first user gesture (browsers block autoplay otherwise)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      if (audioCtxRef.current) return;
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      audioCtxRef.current = new Ctx();
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('click', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const playBeep = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  };

  const { data: unread } = useQuery<AdminUnreadSummary>({
    queryKey: ['admin-unread-summary'],
    queryFn: async () => {
      const { data } = await api.get('/admin/messages/unread-summary');
      return data;
    },
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    enabled: isAdmin,
  });

  const { data: feedbackUnread } = useQuery<{ count: number }>({
    queryKey: ['admin-feedback-unread'],
    queryFn: async () => {
      const { data } = await api.get('/admin/feedback/unread-count');
      return data;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: isAdmin,
  });

  useEffect(() => {
    const next = unread?.count ?? 0;
    const prev = prevCountRef.current;
    if (prev !== null && next > prev && !muted) {
      playBeep();
    }
    prevCountRef.current = next;
  }, [unread?.count, muted]);

  if (!isInitialized || !user || user.role !== ADMIN_ROLE) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  const totalUnread = unread?.count ?? 0;
  const feedbackUnreadCount = feedbackUnread?.count ?? 0;
  const badgeCount: Record<AdminBadge, number> = {
    orders: totalUnread,
    feedback: feedbackUnreadCount,
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Admin header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex h-14 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/catalog" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              На сайт
            </Link>
          </Button>
          <span className="font-bold text-primary">Админ-панель</span>
          <nav className="flex gap-1 ml-auto items-center">
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              const badgeValue = link.badge ? badgeCount[link.badge] : 0;
              const showBadge = link.badge !== null && badgeValue > 0;
              return (
                <Button
                  key={link.href}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link href={link.href} className={cn('gap-1.5 relative', isActive && 'font-semibold')}>
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{link.label}</span>
                    {showBadge && (
                      <Badge
                        variant="destructive"
                        className="h-4 min-w-4 px-1 text-[10px]"
                      >
                        {badgeValue > 99 ? '99+' : badgeValue}
                      </Badge>
                    )}
                  </Link>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMuted((m) => !m)}
              title={muted ? 'Включить звук уведомлений' : 'Выключить звук'}
              aria-label={muted ? 'Включить звук' : 'Выключить звук'}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
