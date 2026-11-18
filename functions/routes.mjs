// Dependency injection is only for local tests. index.ts retains Deno.serve.
// Owner identity comes from the verified platform context, never from the body.
import { runRequired, runOptional, validRun, parseRuns, normalizeClaimRule, claimAssessment, validState } from './core.mjs';

export function application({ db, requireUser, BackendError }) {
  const fail = (code, status) => { throw new BackendError(code, status); };
  const rows = result => { if (result.error) fail(result.error.code, result.error.status); return result.data; };
  const detail = (code, status, message) => Response.json({ error: code, detail: message }, { status });
  const MAX_BODY = 4 * 1024 * 1024;
  const STATE_LIMIT = Math.floor(3.5 * 1024 * 1024);
  const CSV_LIMIT = 2 * 1024 * 1024;
  const MAX_RUNS = 20000;
  const encoder = new TextEncoder();
  async function input(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) fail('invalid_input', 400);
    const reader = request.body?.getReader(); if (!reader) fail('invalid_input', 400);
    let size = 0; const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_BODY) { await reader.cancel(); fail('payload_too_large', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid_input', 400); }
  }
  // Visitor-supplied runs (demo mode) are re-validated and reduced to known fields.
  function visitorRuns(raw) {
    if (!Array.isArray(raw) || raw.length > MAX_RUNS) fail('invalid_input', 400);
    return raw.map(item => {
      if (!item || typeof item !== 'object') fail('invalid_input', 400);
      const run = Object.fromEntries([...runRequired, ...runOptional].map(key => [key, item[key] ?? '']));
      run.seed = String(run.seed);
      run.value = item.value;
      if (!validRun(run)) fail('invalid_input', 400);
      return { ...run, value: Number(run.value), id: String(item.id ?? '').slice(0, 100),
        source: String(item.source ?? '').slice(0, 300), row: Number.isInteger(item.row) ? item.row : null, target: '' };
    });
  }
  function ruleFrom(raw) {
    try { return { rule: normalizeClaimRule(raw) }; } catch (error) { return { error: error.message }; }
  }
  async function workspace(user) {
    const found = rows(await db.from('workspaces').select('state,version').eq('owner_id', user.id).limit(1));
    return found?.[0] ?? null;
  }
  function csvFrom(body) {
    if (typeof body?.csv !== 'string' || !body.csv.trim()) return { error: 'CSV 内容为空。' };
    if (body.csv.length > CSV_LIMIT) return { error: 'CSV 超过 2 MB，请分批导入。' };
    return { csv: body.csv, filename: String(body.filename ?? 'import.csv').slice(0, 200) };
  }
  return async ctx => {
    const request = ctx.request;
    // Gateway preserves the suffix but replaces app with the deployment's
    // physical Function name. Provider may strip /functions/v1 before invocation.
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
    if (!match) fail('not_found', 404);
    const path = match[1] || '/';
    if (path === '/api/health' && request.method === 'GET') return Response.json({ ok: true });

    // Anonymous demo endpoints: stateless, never touch stored workspaces.
    if (path === '/api/demo/import' && request.method === 'POST') {
      const body = await input(request);
      const source = csvFrom(body);
      if (source.error) return detail('invalid_csv', 400, source.error);
      const existing = visitorRuns(body.existing ?? []);
      let result;
      try { result = parseRuns(source.csv, source.filename, existing); }
      catch (error) { return detail('invalid_csv', 400, error.message); }
      return Response.json({ runs: result.pending, added: result.pending.length,
        duplicates: result.duplicates.length, conflicts: result.conflicts.length });
    }
    if (path === '/api/demo/verify' && request.method === 'POST') {
      const body = await input(request);
      const parsed = ruleFrom(body?.rule);
      if (parsed.error) return detail('invalid_rule', 400, parsed.error);
      const runs = visitorRuns(body?.runs);
      return Response.json({ rows: claimAssessment(runs, parsed.rule), rule: parsed.rule, basis: 'demo', verifiedAt: new Date().toISOString() });
    }

    const user = requireUser(ctx);
    if (path === '/api/state' && request.method === 'GET') {
      const row = await workspace(user);
      return Response.json({ state: row?.state ?? null, version: row?.version ?? 0,
        account: { name: typeof user.name === 'string' ? user.name.slice(0, 256) : '' } });
    }
    if (path === '/api/state' && request.method === 'PUT') {
      const body = await input(request);
      if (!Number.isSafeInteger(body?.version) || body.version < 0 || body.version >= 2147483647 || !validState(body?.state)) fail('invalid_input', 400);
      if (encoder.encode(JSON.stringify(body.state)).length > STATE_LIMIT) fail('payload_too_large', 413);
      if (body.version === 0) {
        const inserted = rows(await db.from('workspaces').insertIfAbsent({ owner_id: user.id, state: body.state, version: 1 }, { onConflict: 'owner_id' }).select('version'));
        if (inserted?.length) return Response.json({ version: inserted[0].version });
        fail('write_conflict', 409);
      }
      // Ownership and expected version are predicates of the write itself.
      const updated = rows(await db.from('workspaces').update({ state: body.state, version: body.version + 1, updated_at: new Date().toISOString() })
        .eq('owner_id', user.id).eq('version', body.version).select('version'));
      if (updated?.length) return Response.json({ version: updated[0].version });
      fail('write_conflict', 409);
    }
    if (path === '/api/import' && request.method === 'POST') {
      const body = await input(request);
      if (typeof body?.projectId !== 'string' || !body.projectId || body.projectId.length > 100 ||
          !Number.isSafeInteger(body.version) || body.version < 1) fail('invalid_input', 400);
      const source = csvFrom(body);
      if (source.error) return detail('invalid_csv', 400, source.error);
      const row = await workspace(user);
      if (!row) return detail('no_workspace', 409, '云端还没有保存的课题，请先保存一次再导入。');
      if (row.version !== body.version) fail('write_conflict', 409);
      const target = row.state.projects.find(item => item.id === body.projectId);
      if (!target) return detail('invalid_input', 400, '未找到目标课题，请重新加载后再导入。');
      let result;
      try { result = parseRuns(source.csv, source.filename, target.runs); }
      catch (error) { return detail('invalid_csv', 400, error.message); }
      if (!result.pending.length) {
        return Response.json({ version: row.version, added: 0, duplicates: result.duplicates.length,
          conflicts: result.conflicts.length, runs: target.runs });
      }
      const merged = { ...row.state, projects: row.state.projects.map(item => item.id === target.id ? { ...item, runs: item.runs.concat(result.pending) } : item) };
      if (encoder.encode(JSON.stringify(merged)).length > STATE_LIMIT) {
        return detail('import_too_large', 413, '导入后课题数据超过 3.5 MB，请分批导入或清理运行记录。');
      }
      const updated = rows(await db.from('workspaces').update({ state: merged, version: row.version + 1, updated_at: new Date().toISOString() })
        .eq('owner_id', user.id).eq('version', row.version).select('version'));
      if (!updated?.length) fail('write_conflict', 409);
      return Response.json({ version: updated[0].version, added: result.pending.length,
        duplicates: result.duplicates.length, conflicts: result.conflicts.length, runs: target.runs.concat(result.pending) });
    }
    if (path === '/api/verify' && request.method === 'POST') {
      const body = await input(request);
      if (typeof body?.projectId !== 'string' || !body.projectId || body.projectId.length > 100) fail('invalid_input', 400);
      const parsed = ruleFrom(body?.rule);
      if (parsed.error) return detail('invalid_rule', 400, parsed.error);
      const row = await workspace(user);
      if (!row) return detail('no_workspace', 409, '云端还没有保存的课题，请先保存再核对。');
      const target = row.state.projects.find(item => item.id === body.projectId);
      if (!target) return detail('invalid_input', 400, '未找到目标课题，请重新加载后再核对。');
      return Response.json({ rows: claimAssessment(target.runs, parsed.rule), rule: parsed.rule, basis: 'saved',
        version: row.version, verifiedAt: new Date().toISOString() });
    }
    fail('not_found', 404);
  };
}