import type { Metadata } from 'next';
import { Lora, Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/layout/query-provider';
import { AuthProvider } from '@/components/layout/auth-provider';
import './globals.css';

const lora = Lora({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-lora',
  display: 'swap',
  style: ['normal', 'italic'],
});

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ojakh — Домашние полуфабрикаты, торты и десерты',
  description:
    'Заказ домашних хинкали, пельменей, блинчиков, хлеба на закваске, десертов и тортов в Нижнем Новгороде',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang='ru'
      className={`${lora.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className='min-h-screen bg-background font-sans antialiased'>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster position='bottom-right' richColors closeButton />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
