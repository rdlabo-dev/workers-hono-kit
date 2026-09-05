import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { perfLog } from './perf-log.js';
import type { AnalyticsEngineDatasetLike } from './perf-log.js';

// perfLog は 1 リクエスト = 1 データポイント（Workers Logs / Analytics Engine）を出す。
// route パターンでのグルーピング・colo/cold・両シンクへの出力・sampleRate を固定する。

function fakeDataset() {
  const points: Parameters<AnalyticsEngineDatasetLike['writeDataPoint']>[0][] = [];
  return { writeDataPoint: (e: Parameters<AnalyticsEngineDatasetLike['writeDataPoint']>[0]) => points.push(e), points };
}

/** cf.colo を持つ Request を作る（Workers の incoming request.cf 相当）。 */
function req(path: string, colo = 'NRT'): Request {
  const r = new Request(`https://api.example.com${path}`);
  Object.defineProperty(r, 'cf', { value: { colo }, configurable: true });
  return r;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('perfLog', () => {
  it('Analytics Engine に route パターン・colo・cold で 1 点書く（id は畳まれる）', async () => {
    const ds = fakeDataset();
    const app = new Hono();
    app.use('*', perfLog({ dataset: ds }));
    app.get('/user/:id', (c) => c.json({ ok: true }));

    const res = await app.request(req('/user/4821', 'SJC'));
    expect(res.status).toBe(200);
    expect(ds.points).toHaveLength(1);
    const p = ds.points[0];
    expect(p.blobs?.[0]).toBe('/user/:id'); // 生 path でなく route パターン
    expect(p.blobs?.[1]).toBe('SJC');
    expect(p.indexes).toEqual(['/user/:id']);
    expect(p.doubles?.[1]).toBe(1); // 初回 = cold
    expect(p.doubles?.[2]).toBe(200); // status
    expect(typeof p.doubles?.[0]).toBe('number'); // t_app(ms)
  });

  it('2 回目以降は warm（cold=0）', async () => {
    const ds = fakeDataset();
    const app = new Hono();
    app.use('*', perfLog({ dataset: ds }));
    app.get('/x', (c) => c.text('x'));

    await app.request(req('/x'));
    await app.request(req('/x'));
    // 同一 isolate（module スコープ）なので 2 点目以降は cold=0
    expect(ds.points.at(-1)?.doubles?.[1]).toBe(0);
  });

  it('console:true で {"perf":...} を 1 行出す（Workers Logs 取り込み用）', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = new Hono();
    app.use('*', perfLog({ console: true }));
    app.get('/ping', (c) => c.text('pong'));

    await app.request(req('/ping', 'KIX'));
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0][0] as string) as {
      perf: { path: string; colo: string; t_app: number };
    };
    expect(logged.perf.path).toBe('/ping');
    expect(logged.perf.colo).toBe('KIX');
    expect(logged.perf).toHaveProperty('t_app');
  });

  it('シンク未指定なら何も出さない（既定で無害）', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = new Hono();
    app.use('*', perfLog());
    app.get('/y', (c) => c.text('y'));
    await app.request(req('/y'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('sampleRate=0 は書き込みを止める', async () => {
    const ds = fakeDataset();
    const app = new Hono();
    app.use('*', perfLog({ dataset: ds, sampleRate: 0 }));
    app.get('/z', (c) => c.text('z'));
    await app.request(req('/z'));
    expect(ds.points).toHaveLength(0);
  });

  it('options 未指定でも c.env の PERF / PERF_LOG を拾う（app.fetch(req, env, ctx) 経路）', async () => {
    const ds = fakeDataset();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = new Hono<{ Bindings: { PERF: AnalyticsEngineDatasetLike; PERF_LOG: string } }>();
    app.use('*', perfLog());
    app.get('/w', (c) => c.text('w'));
    // env を fetch に渡すと c.env に載る → bare perfLog() が拾う
    await app.fetch(req('/w'), { PERF: ds, PERF_LOG: '1' });
    expect(ds.points).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('console:false は env の PERF_LOG="1" を明示的に打ち消す（explicit が両方向で勝つ）', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = new Hono<{ Bindings: { PERF_LOG: string } }>();
    app.use('*', perfLog({ console: false }));
    app.get('/off', (c) => c.text('off'));
    await app.fetch(req('/off'), { PERF_LOG: '1' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('未マッチ(404)は (unmatched) に畳んで生 path でカーディナリティを増やさない', async () => {
    const ds = fakeDataset();
    const app = new Hono();
    app.use('*', perfLog({ dataset: ds }));
    app.get('/known', (c) => c.text('k'));
    const res = await app.request(req('/wp-admin/setup.php'));
    expect(res.status).toBe(404);
    expect(ds.points).toHaveLength(1);
    expect(ds.points[0].blobs?.[0]).toBe('(unmatched)');
    expect(ds.points[0].indexes).toEqual(['(unmatched)']);
    expect(ds.points[0].doubles?.[2]).toBe(404);
  });

  it('96 bytes を超える route は blob に保持しつつ短い安定 index で記録する', async () => {
    const ds = fakeDataset();
    const app = new Hono();
    const route =
      '/seatkeep/organizations/:organizationId/venues/:venueId/continuity-entries/:continuityEntryId/reconciliation';
    app.use('*', perfLog({ dataset: ds }));
    app.post(route, (c) => c.json({ ok: true }));

    const path =
      '/seatkeep/organizations/019fb256-fbb3-76ee-a8ef-e6f255c877d5/venues/019fb257-b2ec-762e-8f01-c7d199898111/continuity-entries/019fb25b-64af-751e-b436-f41aa4349e85/reconciliation';
    const first = await app.request(req(path), { method: 'POST' });
    const second = await app.request(req(path), { method: 'POST' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(ds.points).toHaveLength(2);
    expect(ds.points[0].blobs?.[0]).toBe(route);
    expect(ds.points[0].indexes?.[0]).toMatch(/^route:[0-9a-f]{16}$/u);
    expect(new TextEncoder().encode(ds.points[0].indexes?.[0]).byteLength).toBeLessThanOrEqual(96);
    expect(ds.points[1].indexes).toEqual(ds.points[0].indexes);
  });

  it('Analytics Engine の同期例外をアプリ応答へ波及させない', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const app = new Hono();
    app.use(
      '*',
      perfLog({
        dataset: {
          writeDataPoint: () => {
            throw new TypeError('index exceeds 96 bytes');
          },
        },
      }),
    );
    app.get('/healthy', (c) => c.json({ ok: true }));

    const response = await app.request(req('/healthy'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(warning).toHaveBeenCalledOnce();
  });
});
