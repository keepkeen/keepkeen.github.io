type GatewayFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export async function apiFetch(
  gatewayUrl: string,
  path: string,
  options: GatewayFetchOptions = {}
) {
  if (!gatewayUrl) {
    throw new Error('Studio gateway is not configured.');
  }

  const response = await fetch(new URL(path, gatewayUrl).toString(), {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'X-Studio-Client': 'studio',
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let json: { error?: string; [key: string]: unknown } = {};

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Gateway returned non-JSON response.');
    }
  }

  if (!response.ok) {
    throw new Error(json?.error ?? 'Gateway request failed.');
  }

  return json;
}

export function getGatewayTokenFromLocation() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return (
    hashParams.get('gateway_token') ||
    hashParams.get('studio_token') ||
    url.searchParams.get('gateway_token') ||
    url.searchParams.get('studio_token') ||
    ''
  ).trim();
}

export function clearGatewayTokenFromLocation() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  let changed = false;

  ['gateway_token', 'studio_token'].forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }

    if (hashParams.has(key)) {
      hashParams.delete(key);
      changed = true;
    }
  });

  if (!changed) {
    return;
  }

  const nextHash = hashParams.toString();
  const nextUrl = `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}
