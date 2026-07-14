import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtGuard } from './jwt.guard';
import { AdminGuard } from './admin.guard';
import { OptionalJwtGuard } from './optional-jwt.guard';

const SECRET = 'test-access-secret-for-guard-specs-0123456789';

const jwtService = new JwtService({});
const configService = {
  get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? SECRET : undefined),
} as unknown as ConfigService;

function sign(
  payload: Record<string, unknown>,
  opts: { secret?: string; expiresIn?: string } = {},
) {
  return jwtService.sign(payload, {
    secret: opts.secret ?? SECRET,
    expiresIn: (opts.expiresIn ?? '5m') as any,
  });
}

/** Мок ExecutionContext с HTTP-запросом; возвращает и сам request для проверок. */
function makeContext(headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtGuard', () => {
  const guard = new JwtGuard(jwtService, configService);

  it('должен пропустить валидный токен и записать user в request', async () => {
    const token = sign({ sub: 7, email: 'u@test.ru', role: 'user' });
    const { context, request } = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 7, email: 'u@test.ru', role: 'user' });
  });

  it('должен отклонить запрос без заголовка Authorization', async () => {
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('должен отклонить заголовок без схемы Bearer', async () => {
    const token = sign({ sub: 7 });
    const { context } = makeContext({ authorization: `Basic ${token}` });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('должен отклонить просроченный токен', async () => {
    const token = sign({ sub: 7 }, { expiresIn: '-1s' });
    const { context } = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('должен отклонить токен, подписанный другим секретом', async () => {
    const token = sign({ sub: 7 }, { secret: 'another-secret-another-secret-123456' });
    const { context } = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard(jwtService, configService);

  it('должен пропустить администратора', async () => {
    const token = sign({ sub: 1, email: 'a@test.ru', role: 'admin' });
    const { context } = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('должен отклонить обычного пользователя (403)', async () => {
    const token = sign({ sub: 2, email: 'u@test.ru', role: 'user' });
    const { context } = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('должен отклонить запрос без токена (401)', async () => {
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});

describe('OptionalJwtGuard', () => {
  const guard = new OptionalJwtGuard(jwtService, configService);

  it('должен пропустить гостя без заголовка и не заполнять user', async () => {
    const { context, request } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('должен пропустить валидный токен и заполнить user', async () => {
    const token = sign({ sub: 3, email: 'x@test.ru', role: 'user' });
    const { context, request } = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 3 });
  });

  it('должен отклонить присланный, но невалидный токен (не считать гостем)', async () => {
    const { context } = makeContext({ authorization: 'Bearer garbage' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
