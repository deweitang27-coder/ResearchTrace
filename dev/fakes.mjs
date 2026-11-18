// Credential-free local fixtures. Never deployed: kept outside functions/.
export class BackendError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export function makeRequireUser(user) {
  return () => {
    if (!user) throw new BackendError('login_required', 401);
    return user;
  };
}
export function memoryDb() {
  const tables = new Map();
  const table = name => { if (!tables.has(name)) tables.set(name, []); return tables.get(name); };
  return {
    from(name) {
      const q = { filters: [], mode: 'select', payload: null, onConflict: '', limit: 0 };
      const matches = row => q.filters.every(([col, val]) => row[col] === val);
      function execute() {
        const rows = table(name);
        if (q.mode === 'select') {
          let found = rows.filter(matches).map(row => ({ ...row }));
          if (q.limit) found = found.slice(0, q.limit);
          return { data: found, error: null };
        }
        if (q.mode === 'insert' || q.mode === 'insertIfAbsent') {
          const items = Array.isArray(q.payload) ? q.payload : [q.payload];
          const conflictCols = q.onConflict.split(',').filter(Boolean);
          const inserted = [];
          for (const item of items) {
            const clash = conflictCols.length > 0 && rows.some(row => conflictCols.every(col => row[col] === item[col]));
            if (clash) {
              if (q.mode === 'insert') return { data: null, error: { code: 'duplicate_key', status: 409 } };
              continue;
            }
            const row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item };
            rows.push(row);
            inserted.push({ ...row });
          }
          return { data: inserted, error: null };
        }
        if (q.mode === 'update') {
          const updated = [];
          for (const row of rows) if (matches(row)) { Object.assign(row, q.payload); updated.push({ ...row }); }
          return { data: updated, error: null };
        }
        return { data: null, error: { code: 'unsupported_operation', status: 500 } };
      }
      const api = {
        select() { return api; },
        eq(col, val) { q.filters.push([col, val]); return api; },
        limit(n) { q.limit = n; return api; },
        order() { return api; },
        insert(payload) { q.mode = 'insert'; q.payload = payload; return api; },
        insertIfAbsent(payload, opts) { q.mode = 'insertIfAbsent'; q.payload = payload; q.onConflict = opts?.onConflict || ''; return api; },
        update(payload) { q.mode = 'update'; q.payload = payload; return api; },
        then(resolve, reject) { try { resolve(execute()); } catch (error) { reject(error); } }
      };
      return api;
    }
  };
}