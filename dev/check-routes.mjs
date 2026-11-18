// Credential-free checks of the real application routes on the local Node runtime.
import assert from 'node:assert/strict';
import { application } from '../functions/routes.mjs';
import { BackendError, makeRequireUser, memoryDb } from './fakes.mjs';

const db = memoryDb();
const userA = { id: 'user-a' };
const userB = { id: 'user-b' };
const minimalState = active => ({
  version: 1, active,
  projects: [{ id: active, title: '测试课题', question: '', goal: '', demo: false, papers: [], hypotheses: [], tasks: [], datasets: [], runs: [], evidence: [], claimRule: null, notes: [], drafts: {} }]
});
async function call(method, path, { body, raw, user = userA, contentType = 'application/json' } = {}) {
  const handle = application({ db, requireUser: makeRequireUser(user), BackendError });
  const headers = {};
  if (raw !== undefined || body !== undefined) headers['content-type'] = contentType;
  const request = new Request('http://127.0.0.1' + path, { method, headers, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
  try {
    const response = await handle({ request, requestId: 'check' });
    return { status: response.status, body: await response.json() };
  } catch (error) {
    if (error instanceof BackendError) return { status: error.status, body: { error: error.code } };
    throw error;
  }
}
let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log('ok - ' + name); }

await check('health is anonymous', async () => {
  const result = await call('GET', '/functions/v1/app/api/health', { user: null });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
});
await check('state read requires login', async () => {
  const result = await call('GET', '/functions/v1/app/api/state', { user: null });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'login_required');
});
await check('empty workspace returns null state and version 0', async () => {
  const result = await call('GET', '/functions/v1/app/api/state');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { state: null, version: 0, account: { name: '' } });
});
await check('first save creates version 1', async () => {
  const result = await call('PUT', '/functions/v1/app/api/state', { body: { version: 0, state: minimalState('p-a') } });
  assert.equal(result.status, 200);
  assert.equal(result.body.version, 1);
});
await check('read returns persisted state', async () => {
  const result = await call('GET', '/functions/v1/app/api/state');
  assert.equal(result.body.version, 1);
  assert.equal(result.body.state.active, 'p-a');
});
await check('versioned update increments version', async () => {
  const next = minimalState('p-a');
  next.projects[0].title = '改名后的课题';
  const result = await call('PUT', '/functions/v1/app/api/state', { body: { version: 1, state: next } });
  assert.equal(result.body.version, 2);
  const read = await call('GET', '/functions/v1/app/api/state');
  assert.equal(read.body.state.projects[0].title, '改名后的课题');
});
await check('stale version is rejected as write_conflict', async () => {
  const result = await call('PUT', '/functions/v1/app/api/state', { body: { version: 1, state: minimalState('p-a') } });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'write_conflict');
});
await check('second create with version 0 conflicts', async () => {
  const result = await call('PUT', '/functions/v1/app/api/state', { body: { version: 0, state: minimalState('p-a') } });
  assert.equal(result.status, 409);
});
await check('invalid state shape is rejected', async () => {
  for (const state of [null, { version: 2, active: 'x', projects: [] }, { version: 1, active: 'x', projects: [{ id: 'x', title: 't' }] }]) {
    const result = await call('PUT', '/functions/v1/app/api/state', { body: { version: 2, state } });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'invalid_input');
  }
});
await check('invalid versions are rejected', async () => {
  for (const version of [-1, 1.5, 2147483647, '1']) {
    const result = await call('PUT', '/functions/v1/app/api/state', { body: { version, state: minimalState('p-a') } });
    assert.equal(result.status, 400);
  }
});
await check('non-JSON content type is rejected', async () => {
  const result = await call('PUT', '/functions/v1/app/api/state', { raw: 'hello', contentType: 'text/plain' });
  assert.equal(result.status, 400);
});
await check('oversized payload is rejected', async () => {
  const raw = '{"version":2,"state":' + JSON.stringify(minimalState('p-a')) + ',"pad":"' + 'x'.repeat(4 * 1024 * 1024) + '"}';
  const result = await call('PUT', '/functions/v1/app/api/state', { raw });
  assert.equal(result.status, 413);
  assert.equal(result.body.error, 'payload_too_large');
});
await check('unsupported method and unknown path do not succeed', async () => {
  assert.equal((await call('POST', '/functions/v1/app/api/state', { body: {} })).status, 404);
  assert.equal((await call('GET', '/functions/v1/app/api/unknown')).status, 404);
  assert.equal((await call('GET', '/elsewhere')).status, 404);
});
await check('workspaces are isolated per user', async () => {
  const empty = await call('GET', '/functions/v1/app/api/state', { user: userB });
  assert.deepEqual(empty.body, { state: null, version: 0, account: { name: '' } });
  const created = await call('PUT', '/functions/v1/app/api/state', { user: userB, body: { version: 0, state: minimalState('p-b') } });
  assert.equal(created.body.version, 1);
  const mine = await call('GET', '/functions/v1/app/api/state');
  assert.equal(mine.body.state.active, 'p-a');
  assert.equal(mine.body.version, 2);
});
await check('physical and provider-stripped path variants route correctly', async () => {
  const physical = await call('GET', '/functions/v1/app-d' + '0'.repeat(32) + '/api/health', { user: null });
  assert.equal(physical.status, 200);
  const stripped = await call('GET', '/app/api/state');
  assert.equal(stripped.body.version, 2);
});

const csvHeader = 'dataset,method,seed,split,metric,value,config,commit,note';
const csvTwo = csvHeader + '\nGunPoint,MiniRocket,0,TEST-v1,accuracy,0.90,baseline.yaml,,\nGunPoint,Router-25,0,TEST-v1,accuracy,0.92,router25.yaml,,\n';
const claimRule = { statement: '路由提升准确率', datasets: ['GunPoint'], base: 'MiniRocket', test: 'Router-25', metric: 'accuracy', threshold: 0, minPairs: 1 };
const userC = { id: 'user-c', name: '迁移目标账号' };

await check('state read exposes the verified account name', async () => {
  const result = await call('GET', '/functions/v1/app/api/state', { user: { id: 'user-a', name: '测试账号' } });
  assert.equal(result.body.account.name, '测试账号');
});
await check('runs missing required fields are rejected on save', async () => {
  const bad = minimalState('p-a');
  bad.projects[0].runs = [{ dataset: 'D', method: 'M', seed: '', split: 'S', metric: 'accuracy', value: 0.9 }];
  const result = await call('PUT', '/functions/v1/app/api/state', { body: { version: 2, state: bad } });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'invalid_input');
  const stringValue = minimalState('p-a');
  stringValue.projects[0].runs = [{ dataset: 'D', method: 'M', seed: '0', split: 'S', metric: 'accuracy', value: '0.9' }];
  assert.equal((await call('PUT', '/functions/v1/app/api/state', { body: { version: 2, state: stringValue } })).status, 400);
  const badEvidence = minimalState('p-a');
  badEvidence.projects[0].evidence = [{ id: 'e', title: 't', pairs: [{ base: { dataset: 'D' }, test: {} }] }];
  assert.equal((await call('PUT', '/functions/v1/app/api/state', { body: { version: 2, state: badEvidence } })).status, 400);
});
await check('server import validates, dedupes and writes atomically', async () => {
  const result = await call('POST', '/functions/v1/app/api/import', { body: { projectId: 'p-a', csv: csvTwo, filename: 't.csv', version: 2 } });
  assert.equal(result.status, 200);
  assert.equal(result.body.added, 2);
  assert.equal(result.body.version, 3);
  assert.equal(result.body.runs.length, 2);
  assert.equal(result.body.runs[0].row, 2);
  const read = await call('GET', '/functions/v1/app/api/state');
  assert.equal(read.body.version, 3);
  assert.equal(read.body.state.projects[0].runs.length, 2);
});
await check('re-submitting the same CSV adds nothing', async () => {
  const result = await call('POST', '/functions/v1/app/api/import', { body: { projectId: 'p-a', csv: csvTwo, filename: 't.csv', version: 3 } });
  assert.equal(result.status, 200);
  assert.equal(result.body.added, 0);
  assert.equal(result.body.duplicates, 2);
  assert.equal(result.body.version, 3);
});
await check('import with stale version conflicts', async () => {
  const result = await call('POST', '/functions/v1/app/api/import', { body: { projectId: 'p-a', csv: csvTwo, filename: 't.csv', version: 2 } });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'write_conflict');
});
await check('import rejects invalid CSV with a safe detail', async () => {
  const missingValue = csvHeader + '\nGunPoint,MiniRocket,0,TEST-v1,accuracy,,baseline.yaml,,\n';
  const result = await call('POST', '/functions/v1/app/api/import', { body: { projectId: 'p-a', csv: missingValue, filename: 'bad.csv', version: 3 } });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'invalid_csv');
  assert.match(result.body.detail, /第 2 行/);
  const missingColumn = 'dataset,method,seed,split,metric\nD,M,0,S,accuracy\n';
  const column = await call('POST', '/functions/v1/app/api/import', { body: { projectId: 'p-a', csv: missingColumn, filename: 'bad.csv', version: 3 } });
  assert.equal(column.body.error, 'invalid_csv');
  assert.match(column.body.detail, /缺少列/);
  const read = await call('GET', '/functions/v1/app/api/state');
  assert.equal(read.body.state.projects[0].runs.length, 2);
});
await check('import requires an existing workspace and project', async () => {
  const fresh = await call('POST', '/functions/v1/app/api/import', { user: userC, body: { projectId: 'p-a', csv: csvTwo, filename: 't.csv', version: 1 } });
  assert.equal(fresh.status, 409);
  assert.equal(fresh.body.error, 'no_workspace');
  const unknown = await call('POST', '/functions/v1/app/api/import', { body: { projectId: 'missing', csv: csvTwo, filename: 't.csv', version: 3 } });
  assert.equal(unknown.status, 400);
});
await check('claim verification runs on saved records with seed, row and config', async () => {
  const result = await call('POST', '/functions/v1/app/api/verify', { body: { projectId: 'p-a', rule: claimRule } });
  assert.equal(result.status, 200);
  assert.equal(result.body.basis, 'saved');
  assert.equal(result.body.version, 3);
  const row = result.body.rows[0];
  assert.equal(row.status, 'supported');
  assert.equal(row.result.pairs.length, 1);
  assert.equal(row.result.pairs[0].base.seed, '0');
  assert.equal(row.result.pairs[0].base.row, 2);
  assert.equal(row.result.pairs[0].base.config, 'baseline.yaml');
  assert.equal(row.result.pairs[0].test.config, 'router25.yaml');
  const counter = await call('POST', '/functions/v1/app/api/verify', { body: { projectId: 'p-a', rule: { ...claimRule, threshold: 5 } } });
  assert.equal(counter.body.rows[0].status, 'below');
  const missing = await call('POST', '/functions/v1/app/api/verify', { body: { projectId: 'p-a', rule: { ...claimRule, datasets: ['NoSuchDataset'] } } });
  assert.equal(missing.body.rows[0].status, 'missing');
});
await check('invalid claim rules are rejected with a detail', async () => {
  const result = await call('POST', '/functions/v1/app/api/verify', { body: { projectId: 'p-a', rule: { ...claimRule, base: claimRule.test } } });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'invalid_rule');
  assert.ok(result.body.detail);
});
await check('demo verify is anonymous and stateless', async () => {
  const runs = [
    { dataset: 'GunPoint', method: 'MiniRocket', seed: '0', split: 'T', metric: 'accuracy', value: 0.9, config: 'b.yaml', source: 'demo.csv', row: 2 },
    { dataset: 'GunPoint', method: 'Router-25', seed: '0', split: 'T', metric: 'accuracy', value: 0.92, config: 'r.yaml', source: 'demo.csv', row: 3 }
  ];
  const result = await call('POST', '/functions/v1/app/api/demo/verify', { user: null, body: { runs, rule: claimRule } });
  assert.equal(result.status, 200);
  assert.equal(result.body.basis, 'demo');
  assert.equal(result.body.rows[0].status, 'supported');
  assert.equal(result.body.rows[0].result.pairs[0].base.row, 2);
  const bad = await call('POST', '/functions/v1/app/api/demo/verify', { user: null, body: { runs: [{ ...runs[0], seed: '' }], rule: claimRule } });
  assert.equal(bad.status, 400);
});
await check('demo import validates and dedupes without storage', async () => {
  const first = await call('POST', '/functions/v1/app/api/demo/import', { user: null, body: { csv: csvTwo, filename: 'demo.csv', existing: [] } });
  assert.equal(first.status, 200);
  assert.equal(first.body.added, 2);
  const again = await call('POST', '/functions/v1/app/api/demo/import', { user: null, body: { csv: csvTwo, filename: 'demo.csv', existing: first.body.runs } });
  assert.equal(again.body.added, 0);
  assert.equal(again.body.duplicates, 2);
  const bad = await call('POST', '/functions/v1/app/api/demo/import', { user: null, body: { csv: csvHeader + '\nD,M,0,S,accuracy,,,\n', filename: 'x.csv', existing: [] } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'invalid_csv');
});
await check('state and import enforce the workspace size limit', async () => {
  const LIMIT = Math.floor(3.5 * 1024 * 1024);
  const base = minimalState('p-big');
  const overhead = Buffer.byteLength(JSON.stringify(base));
  base.projects[0].drafts = { '方法': 'x'.repeat(LIMIT - overhead + 1) };
  const tooBig = await call('PUT', '/functions/v1/app/api/state', { user: userC, body: { version: 0, state: base } });
  assert.equal(tooBig.status, 413);
  base.projects[0].drafts = { '方法': 'x'.repeat(LIMIT - overhead - 100) };
  const created = await call('PUT', '/functions/v1/app/api/state', { user: userC, body: { version: 0, state: base } });
  assert.equal(created.status, 200);
  const importBig = await call('POST', '/functions/v1/app/api/import', { user: userC, body: { projectId: 'p-big', csv: csvTwo, filename: 't.csv', version: 1 } });
  assert.equal(importBig.status, 413);
  assert.equal(importBig.body.error, 'import_too_large');
  const read = await call('GET', '/functions/v1/app/api/state', { user: userC });
  assert.equal(read.body.state.projects[0].runs.length, 0);
});
console.log(passed + ' checks passed.');