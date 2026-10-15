import { exportPKCS8, generateKeyPair } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityToolkit } from './identity-toolkit.js';
import type { ServiceAccount } from './identity-toolkit.js';

const NOW = 1_700_000_000;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function makeServiceAccount(): Promise<ServiceAccount> {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return {
    client_email: 'svc@proj.iam.gserviceaccount.com',
    private_key: await exportPKCS8(privateKey),
    project_id: 'proj',
  };
}

function stubFetch(handler: (url: string) => Response) {
  const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => handler(input));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const tokenResponse = () => new Response(JSON.stringify({ access_token: 'at-1', expires_in: 3600 }), { status: 200 });

describe('IdentityToolkit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lookupByEmail uses the primary email and shares the OAuth token cache with UID lookups', async () => {
    const request = stubFetch((url) =>
      url === TOKEN_URL
        ? tokenResponse()
        : Response.json({
            users: [
              { localId: 'other', email: 'other@example.com' },
              { localId: 'uid1', email: 'User@example.com' },
            ],
          }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.lookupByEmail(' user@example.com ', NOW)).resolves.toEqual({
      uid: 'uid1',
      email: 'User@example.com',
    });
    const call = request.mock.calls.find(([url]) => url.endsWith('accounts:lookup'));
    expect(JSON.parse(call?.[1]?.body as string)).toEqual({ email: ['user@example.com'] });
    await client.lookup('uid1', NOW + 1);
    expect(request.mock.calls.filter(([url]) => url === TOKEN_URL)).toHaveLength(1);
  });

  it('lookupByEmail returns null for missing or invalid addresses', async () => {
    const client = new IdentityToolkit(await makeServiceAccount());
    const request = stubFetch((url) => (url === TOKEN_URL ? tokenResponse() : Response.json({ users: [] })));
    await expect(client.lookupByEmail(' ', NOW)).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
    await expect(client.lookupByEmail('missing@example.com', NOW)).resolves.toBeNull();
    stubFetch(() => Response.json({ error: { message: 'INVALID_EMAIL' } }, { status: 400 }));
    await expect(client.lookupByEmail('invalid', NOW)).resolves.toBeNull();
  });

  it.each([400, 403, 429, 500])('lookupByEmail throws for provider failures (%i)', async (status) => {
    stubFetch((url) =>
      url === TOKEN_URL
        ? tokenResponse()
        : Response.json({ error: { message: 'CONFIGURATION_NOT_FOUND' } }, { status }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.lookupByEmail('user@example.com', NOW)).rejects.toThrow(
      `Identity Toolkit lookup failed: ${status}`,
    );
  });

  it('lookupByEmail rejects malformed records without including account values', async () => {
    stubFetch((url) =>
      url === TOKEN_URL ? tokenResponse() : Response.json({ users: [{ email: 'private@example.com' }] }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.lookupByEmail('private@example.com', NOW)).rejects.toThrow(
      'Invalid Identity Toolkit lookup response',
    );
  });

  it('returns disabled metadata for UID, batch and email lookups', async () => {
    stubFetch((url) =>
      url === TOKEN_URL
        ? tokenResponse()
        : Response.json({
            users: [{ localId: 'uid1', email: 'a@b.c', disabled: true }],
          }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());
    const expected = { uid: 'uid1', email: 'a@b.c', disabled: true };
    await expect(client.lookup('uid1', NOW)).resolves.toEqual(expected);
    await expect(client.lookupMany(['uid1', 'uid1'], NOW)).resolves.toEqual([expected]);
    await expect(client.lookupByEmail('a@b.c', NOW)).resolves.toEqual(expected);
  });

  it('uses global fetch without a client receiver in Workers', async () => {
    vi.stubGlobal('fetch', async function (this: unknown, input: Parameters<typeof fetch>[0]) {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return input === TOKEN_URL ? tokenResponse() : Response.json({ users: [] });
    });
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.lookup('missing', NOW)).resolves.toBeNull();
  });

  it('lookup はアクセストークンを取得してユーザーを返す', async () => {
    const fetchMock = stubFetch((url) => {
      if (url === TOKEN_URL) {
        return tokenResponse();
      }
      if (url.endsWith('accounts:lookup')) {
        return new Response(JSON.stringify({ users: [{ localId: 'uid1', email: 'a@b.c' }] }), { status: 200 });
      }
      return new Response('no', { status: 404 });
    });
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.lookup('uid1', NOW)).resolves.toEqual({ uid: 'uid1', email: 'a@b.c' });
    const lookupCall = fetchMock.mock.calls.find(([u]) => u.endsWith('accounts:lookup'));
    expect(lookupCall?.[1]).toMatchObject({ method: 'POST' });
  });

  it('lookup で該当ユーザーが無ければ null', async () => {
    stubFetch((url) =>
      url === TOKEN_URL ? tokenResponse() : new Response(JSON.stringify({ users: [] }), { status: 200 }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.lookup('missing', NOW)).resolves.toBeNull();
  });

  it('lookup throws on provider failure instead of treating it as absence', async () => {
    stubFetch((url) => (url === TOKEN_URL ? tokenResponse() : new Response('forbidden', { status: 403 })));
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.lookup('uid1', NOW)).rejects.toThrow('Identity Toolkit lookup failed: 403');
  });

  it('アクセストークンを isolate 内でキャッシュする（token 交換は 1 回）', async () => {
    const fetchMock = stubFetch((url) =>
      url === TOKEN_URL
        ? tokenResponse()
        : new Response(JSON.stringify({ users: [{ localId: 'uid1' }] }), { status: 200 }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());
    await client.lookup('uid1', NOW);
    await client.lookup('uid1', NOW + 10);
    const tokenCalls = fetchMock.mock.calls.filter(([u]) => u === TOKEN_URL);
    expect(tokenCalls).toHaveLength(1);
  });

  it('lookupMany は複数 uid を 1 回の accounts:lookup で localId 配列として送る', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === TOKEN_URL) {
        return tokenResponse();
      }
      return new Response(
        JSON.stringify({
          users: [{ localId: 'uid1', email: 'a@b.c' }, { localId: 'uid2', email: 'd@e.f' }, { localId: 'uid3' }],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new IdentityToolkit(await makeServiceAccount());

    await expect(client.lookupMany(['uid1', 'uid2', 'uid3'], NOW)).resolves.toEqual([
      { uid: 'uid1', email: 'a@b.c' },
      { uid: 'uid2', email: 'd@e.f' },
      { uid: 'uid3', email: undefined },
    ]);

    const lookupCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith('accounts:lookup'));
    expect(lookupCalls).toHaveLength(1);
    const body = JSON.parse(lookupCalls[0][1]?.body as string) as { localId: string[] };
    expect(body).toEqual({ localId: ['uid1', 'uid2', 'uid3'] });
  });

  it('lookupMany は 101 件を 100 件 + 1 件の 2 回にチャンクして結果を結合する', async () => {
    const uids = Array.from({ length: 101 }, (_, i) => `uid${i}`);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === TOKEN_URL) {
        return tokenResponse();
      }
      const body = JSON.parse(init?.body as string) as { localId: string[] };
      const users = body.localId.map((localId) => ({ localId }));
      return new Response(JSON.stringify({ users }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new IdentityToolkit(await makeServiceAccount());

    const result = await client.lookupMany(uids, NOW);

    const lookupCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith('accounts:lookup'));
    expect(lookupCalls).toHaveLength(2);
    const firstBody = JSON.parse(lookupCalls[0][1]?.body as string) as { localId: string[] };
    const secondBody = JSON.parse(lookupCalls[1][1]?.body as string) as { localId: string[] };
    expect(firstBody.localId).toHaveLength(100);
    expect(secondBody.localId).toHaveLength(1);
    expect(result).toHaveLength(101);
    expect(result.map((u) => u.uid)).toEqual(uids);
  });

  it('lookupMany は Firebase が返さなかった uid を結果から単に除外する（null にしない）', async () => {
    const fetchMock = stubFetch((url) =>
      url === TOKEN_URL
        ? tokenResponse()
        : new Response(JSON.stringify({ users: [{ localId: 'uid1', email: 'a@b.c' }] }), { status: 200 }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());

    await expect(client.lookupMany(['uid1', 'missing'], NOW)).resolves.toEqual([{ uid: 'uid1', email: 'a@b.c' }]);
    const lookupCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith('accounts:lookup'));
    expect(lookupCalls).toHaveLength(1);
  });

  it('lookupMany は空配列に対して通信せず [] を返す', async () => {
    const fetchMock = stubFetch(() => new Response('should not be called', { status: 500 }));
    const client = new IdentityToolkit(await makeServiceAccount());

    await expect(client.lookupMany([], NOW)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('remove は成功時に解決し、失敗時に throw する', async () => {
    stubFetch((url) => (url === TOKEN_URL ? tokenResponse() : new Response(null, { status: 200 })));
    const client = new IdentityToolkit(await makeServiceAccount());
    await expect(client.remove('uid1', NOW)).resolves.toBeUndefined();

    stubFetch((url) => (url === TOKEN_URL ? tokenResponse() : new Response('err', { status: 500 })));
    const client2 = new IdentityToolkit(await makeServiceAccount());
    await expect(client2.remove('uid1', NOW)).rejects.toThrow('Identity Toolkit delete failed');
  });

  it('remove は USER_NOT_FOUND を削除済みとして成功扱いにする', async () => {
    stubFetch((url) =>
      url === TOKEN_URL
        ? tokenResponse()
        : new Response(JSON.stringify({ error: { code: 400, message: 'USER_NOT_FOUND' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
    );
    const client = new IdentityToolkit(await makeServiceAccount());

    await expect(client.remove('already-deleted', NOW)).resolves.toBeUndefined();
  });
});
