import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/layout/query-provider';
import { AuthProvider } from '@/components/layout/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ojakh — Домашние полуфабрикаты, торты и десерты',
  description: 'Заказ домашних хинкали, пельменей, блинчиков, хлеба на закваске, десертов и тортов в Нижнем Новгороде',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
