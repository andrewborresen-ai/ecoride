export function ok(data: unknown, meta?: unknown) {
  return { success: true, data, error: null, meta: meta ?? null };
}

export function fail(error: string, status = 400) {
  return { success: false, data: null, error, meta: null, _status: status };
}
