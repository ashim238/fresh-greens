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
    const headers = new Headers(init?.headers);

    if (url.includes('/rest/v1/') || url.includes('/functions/v1/')) {
      headers.set('x-device-uuid', await readDeviceUUID());
    }

    return baseFetch(input, { ...init, headers });
  };
}
