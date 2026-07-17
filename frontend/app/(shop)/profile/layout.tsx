import type { Metadata } from 'next';

// Страницы клиентские — метаданные (в т.ч. noindex) задаёт этот layout.
// Покрывает /profile и /profile/addresses.
export const metadata: Metadata = {
  title: 'Профиль',
  robots: { index: false, follow: true },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
