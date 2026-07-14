// Cookie-метка наличия сессии на домене фронтенда.
//
// Настоящий refresh-токен — httpOnly-cookie API-домена (ojakh.api.whysargis.ru),
// и middleware фронтенда его не видит: домены разные. Поэтому при успешном
// логине ставим на своём домене лёгкую метку без секретов. middleware.ts
// использует её как первую линию обороны (редирект гостей с приватных роутов);
// настоящая авторизация всегда проверяется бекендом по JWT.

export const SESSION_COOKIE = 'ojakh_session';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 дней — как у refresh-токена

export function setSessionCookie() {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
