import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createIdentityAuthFailureBody } from '../http/auth-failure.js';
import { createHttpErrorHandler } from '../http/http-error.js';
import { AuthTokenMissingError, createAuthMiddleware } from './auth.js';
import type { AuthMiddlewareOptions } from './auth.js';

interface Decoded {
  uid: string;
}

interface TestEnv {
  Variables: {
    userId?: number;
    decodedToken?: Decoded;
    appInfo?: { version: string | null; uuid: string | null };
  };
}

const baseOptions: AuthMiddlewareOptions<TestEnv, Decoded, number> = {
  verify: async (token) => {
    if (token !== 'good') {
      throw new Error('invalid token');
    }
    return { uid: 'u1' };
  },
  resolveUserId: async () => 42,
  setContext: (c, { verified, appInfo, userId }) => {
    c.set('userId', userId);
    c.set('decodedToken', verified);
    c.set('appInfo', appInfo);
  },
};

function appWith(options: AuthMiddlewareOptions<TestEnv, Decoded, number>) {
  const app = new Hono<TestEnv>();
  app.onError(createHttpErrorHandler());
  app.use('/guarded', createAuthMiddleware(options));
  app.get('/guarded', (c) =>
    c.json({
      userId: c.get('userId') ?? null,
      decoded: c.get('decodedToken') ?? null,
      appInfo: c.get('appInfo') ?? null,
    }),
  );
  return app;
}

const goodHeaders = {
  'x-amz-security-token': 'good',
  'x-amz-meta-version': '1.0.0',
  'x-amz-meta-uuid': 'abc',
};

describe('createAuthMiddleware', () => {
  it('検証成功で userId / record / appInfo を c.var にセットする', async () => {
    const res = await appWith(baseOptions).request('/guarded', { headers: goodHeaders });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userId: 42,
      decoded: { uid: 'u1' },
      appInfo: { version: '1.0.0', uuid: 'abc' },
    });
  });

  it('検証失敗は既定で 403 HTTPException を throw する（onError が Nest body を描く）', async () => {
    const res = await appWith(baseOptions).request('/guarded', { headers: { 'x-amz-security-token': 'bad' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' });
  });

  it('resolveUserId の reject も失敗として扱う（create-on-miss 失敗 → 既定 403）', async () => {
    const res = await appWith({
      ...baseOptions,
      resolveUserId: async () => {
        throw new Error('user provisioning failed');
      },
    }).request('/guarded', { headers: goodHeaders });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' });
  });

  it.each([
    ['verify', { headers: { 'x-amz-security-token': 'bad' } }],
    ['resolveUserId', { headers: goodHeaders }],
  ])('%s 失敗を明示設定どおり identity 401 契約へ接続する', async (failure, init) => {
    const res = await appWith({
      ...baseOptions,
      resolveUserId:
        failure === 'resolveUserId'
          ? async () => {
              throw new Error('user resolution failed');
            }
          : baseOptions.resolveUserId,
      onFailure: (_error, context) => context.json(createIdentityAuthFailureBody(), 401),
    }).request('/guarded', init);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(createIdentityAuthFailureBody());
  });

  it('resolveUserId は検証済み record と appInfo を受け取る', async () => {
    let received: { verified: Decoded; appInfo: unknown } | undefined;
    await appWith({
      ...baseOptions,
      resolveUserId: async (verified, _c, appInfo) => {
        received = { verified, appInfo };
        return 7;
      },
    }).request('/guarded', { headers: goodHeaders });
    expect(received).toEqual({ verified: { uid: 'u1' }, appInfo: { version: '1.0.0', uuid: 'abc' } });
  });

  it('onFailure を渡すと throw ではなく return 形のレスポンスにできる（winecode 互換）', async () => {
    const FORBIDDEN_BODY = { message: 'Forbidden resource', error: 'Forbidden', statusCode: 403 } as const;
    const res = await appWith({
      ...baseOptions,
      onFailure: (_e, c) => c.json(FORBIDDEN_BODY, 403),
    }).request('/guarded', { headers: {} });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(FORBIDDEN_BODY);
  });

  it.each([undefined, '', '   '])('欠落・空白token (%s) はverifyせずtoken段階で拒否する', async (token) => {
    const verify = vi.fn(baseOptions.verify);
    const reportFailure = vi.fn();
    const onFailure = vi.fn((_error, c: Parameters<NonNullable<typeof baseOptions.onFailure>>[1]) =>
      c.json(createIdentityAuthFailureBody(), 401),
    );
    const headers: Record<string, string> = token === undefined ? {} : { 'x-amz-security-token': token };

    const res = await appWith({
      ...baseOptions,
      rejectMissingToken: true,
      verify,
      reportFailure,
      onFailure,
    }).request('/guarded', { headers });

    expect(res.status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
    expect(reportFailure).toHaveBeenCalledWith(expect.any(AuthTokenMissingError), expect.anything(), {
      stage: 'token',
      tokenPresent: false,
    });
    expect(onFailure).toHaveBeenCalledWith(expect.any(AuthTokenMissingError), expect.anything(), {
      stage: 'token',
      tokenPresent: false,
    });
  });

  it('既定ではheader欠落を従来どおり空文字としてverifyへ渡す', async () => {
    const verify = vi.fn(baseOptions.verify);
    const reportFailure = vi.fn();

    await appWith({ ...baseOptions, verify, reportFailure }).request('/guarded');

    expect(verify).toHaveBeenCalledWith('', expect.anything());
    expect(reportFailure).toHaveBeenCalledWith(expect.any(Error), expect.anything(), {
      stage: 'verify',
      tokenPresent: false,
    });
  });

  it.each([
    ['verify', { verify: async () => Promise.reject(new Error('verify failed')) }],
    ['resolveUserId', { resolveUserId: async () => Promise.reject(new Error('resolve failed')) }],
    [
      'setContext',
      {
        setContext: () => {
          throw new Error('context failed');
        },
      },
    ],
  ] as const)('%s の失敗段階をtokenを含めずreportFailureへ渡す', async (stage, overrides) => {
    const reportFailure = vi.fn();
    const res = await appWith({
      ...baseOptions,
      ...overrides,
      reportFailure,
      onFailure: (_error, c) => c.json(createIdentityAuthFailureBody(), 401),
    }).request('/guarded', { headers: goodHeaders });

    expect(res.status).toBe(401);
    expect(reportFailure).toHaveBeenCalledWith(expect.any(Error), expect.anything(), {
      stage,
      tokenPresent: true,
    });
  });

  it('reportFailure 自体の失敗は認証レスポンスを変えない', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await appWith({
      ...baseOptions,
      reportFailure: () => {
        throw new Error('reporter failed');
      },
      onFailure: (_error, c) => c.json(createIdentityAuthFailureBody(), 401),
    }).request('/guarded', { headers: { 'x-amz-security-token': 'bad' } });

    expect(res.status).toBe(401);
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toMatchObject({ message: 'reporter failed' });
    consoleError.mockRestore();
  });

  it('resolveUserId を省くと token-only（userId 解決なし）になる', async () => {
    const res = await appWith({
      verify: baseOptions.verify,
      setContext: (c, { verified }) => {
        c.set('decodedToken', verified);
      },
    }).request('/guarded', { headers: goodHeaders });
    expect(await res.json()).toEqual({ userId: null, decoded: { uid: 'u1' }, appInfo: null });
  });

  it('failureStatus を上書きできる（token guard の 401）', async () => {
    const res = await appWith({
      verify: baseOptions.verify,
      setContext: (c, { verified }) => {
        c.set('decodedToken', verified);
      },
      failureStatus: 401,
      failureMessage: 'Unauthorized',
    }).request('/guarded', { headers: {} });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ statusCode: 401, message: 'Unauthorized' });
  });

  it('tokenHeader を上書きでき、既定ヘッダは参照しない', async () => {
    const options: AuthMiddlewareOptions<TestEnv, Decoded, number> = { ...baseOptions, tokenHeader: 'authorization' };
    const ok = await appWith(options).request('/guarded', { headers: { authorization: 'good' } });
    expect(ok.status).toBe(200);

    // 既定ヘッダに入れても、tokenHeader を変えた以上は読まれず失敗する。
    const miss = await appWith(options).request('/guarded', { headers: { 'x-amz-security-token': 'good' } });
    expect(miss.status).toBe(403);
  });
});
