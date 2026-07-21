export function createSupabaseTransport(
  baseFetch: typeof fetch,
  readDeviceUUID: () => Promise<string>,
): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    const pathname = new URL(url).pathname;

    if (pathname.startsWith('/rest/v1/') || pathname.startsWith('/functions/v1/')) {
      headers.set('x-device-uuid', await readDeviceUUID());
    }

    return baseFetch(input, { ...init, headers });
  };
}
