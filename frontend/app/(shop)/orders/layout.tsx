import type { Metadata } from 'next';

// Страницы клиентские — метаданные (в т.ч. noindex) задаёт этот layout.
// Покрывает /orders и /orders/[id].
export const metadata: Metadata = {
  title: 'Мои заказы',
  robots: { index: false, follow: true },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
