'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, Package, CalendarDays, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

const adminLinks = [
  { href: '/admin', label: 'Заказы', icon: ClipboardList },
  { href: '/admin/products', label: 'Товары', icon: Package },
  { href: '/admin/calendar', label: 'Календарь', icon: CalendarDays },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'admin')) {
      router.replace('/catalog');
    }
  }, [user, isInitialized, router]);

  if (!isInitialized || !user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

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
          <nav className="flex gap-1 ml-auto">
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Button
                  key={link.href}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link href={link.href} className={cn('gap-1.5', isActive && 'font-semibold')}>
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
