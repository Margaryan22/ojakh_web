import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session-cookie';

// Первая линия обороны приватных роутов: гостей (нет cookie-метки сессии,
// см. lib/session-cookie.ts) отправляем на логин ещё на edge, до загрузки
// клиентского JS. Роль admin в cookie не видна и здесь не проверяется —
// это делает клиентский guard в app/admin/layout.tsx, а настоящая
// авторизация — guards бекенда.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (hasSession) return NextResponse.next();

  // Параметр next читает страница логина (lib/post-auth.ts, readNextFromQuery).
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set(
    'next',
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/profile/:path*', '/orders/:path*', '/favorites'],
};
