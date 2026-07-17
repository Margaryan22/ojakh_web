import type { Metadata } from 'next';

// Страница клиентская — метаданные (в т.ч. noindex) задаёт этот layout.
export const metadata: Metadata = {
  title: 'Корзина',
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
