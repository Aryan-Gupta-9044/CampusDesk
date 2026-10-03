// Minimal in-memory stand-in for the supabase-js query builder, just enough
// for the fee flows: from().select().eq().order() / maybeSingle() / single(),
// insert(), update().eq().select(). Mimics the partial unique index that
// fee_payment_guard_patch.sql adds (one pending row per student+fee).
let counter = 0;

export function createFakeDb(initial = {}) {
  const tables = {
    fee_structure: [],
    fee_payments: [],
    students: [],
    ...initial,
  };

  function builder(table) {
    const state = { op: "select", filters: [], payload: null, wantRows: false };

    const run = () => {
      const rows = tables[table];
      const match = (r) => state.filters.every(([k, v]) => r[k] === v);

      if (state.op === "insert") {
        const row = { id: `${table}-${++counter}`, ...state.payload };
        if (
          table === "fee_payments" &&
          row.status === "pending_verification" &&
          rows.some(
            (r) =>
              r.status === "pending_verification" &&
              r.student_id === row.student_id &&
              r.fee_structure_id === row.fee_structure_id
          )
        ) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        rows.push(row);
        return { data: [row], error: null };
      }
      if (state.op === "update") {
        const hit = rows.filter(match);
        hit.forEach((r) => Object.assign(r, state.payload));
        return { data: hit.map((r) => ({ id: r.id })), error: null };
      }
      return { data: rows.filter(match).map((r) => ({ ...r })), error: null };
    };

    const api = {
      select: () => api,
      order: () => api,
      eq: (k, v) => {
        state.filters.push([k, v]);
        return api;
      },
      insert: (payload) => {
        state.op = "insert";
        state.payload = payload;
        return api;
      },
      update: (payload) => {
        state.op = "update";
        state.payload = payload;
        return api;
      },
      maybeSingle: async () => {
        const { data, error } = run();
        return { data: data && data[0] ? data[0] : null, error };
      },
      single: async () => {
        const { data, error } = run();
        return { data: data && data[0] ? data[0] : null, error };
      },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    };
    return api;
  }

  return { tables, client: { from: (t) => builder(t) } };
}
