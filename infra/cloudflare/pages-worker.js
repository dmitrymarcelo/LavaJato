const API_ORIGIN = 'https://3-145-153-19.sslip.io';

const hopByHopHeaders = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

function isProxyPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/') || pathname === '/uploads' || pathname.startsWith('/uploads/');
}

function cleanHeaders(headers) {
  const nextHeaders = new Headers(headers);
  for (const header of hopByHopHeaders) {
    nextHeaders.delete(header);
  }
  return nextHeaders;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!isProxyPath(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    const targetUrl = new URL(url.pathname + url.search, API_ORIGIN);
    const headers = cleanHeaders(request.headers);
    headers.delete('host');
    headers.set('x-forwarded-host', url.host);
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: cleanHeaders(response.headers),
    });
  },
};
