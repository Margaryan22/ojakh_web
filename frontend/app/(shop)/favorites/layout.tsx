import type { Metadata } from 'next';

// Страница клиентская — метаданные (в т.ч. noindex) задаёт этот layout.
export const metadata: Metadata = {
  title: 'Избранное',
  robots: { index: false, follow: true },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
