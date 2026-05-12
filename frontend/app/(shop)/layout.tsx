import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { LenisProvider } from '@/components/editorial/lenis-provider';
import { PageTransitions } from '@/components/editorial/page-transitions';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LenisProvider>
      <div className='min-h-screen flex flex-col'>
        <Header />
        <main className='flex-1'>
          <PageTransitions>
            <div className='max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-14'>
              {children}
            </div>
          </PageTransitions>
        </main>
        <Footer />
      </div>
    </LenisProvider>
  );
}
