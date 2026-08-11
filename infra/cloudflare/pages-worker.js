const SUPABASE_PROJECT_REF = 'vqutbhklwnvvpmvletqb';
const API_ORIGIN = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1`;
const STORAGE_ORIGIN = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/uploads`;

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

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const targetUrl = `${API_ORIGIN}${url.pathname}${url.search}`;
      const headers = cleanHeaders(request.headers);
      headers.delete('host');

      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'follow',
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: cleanHeaders(response.headers),
      });
    }

    if (url.pathname === '/uploads' || url.pathname.startsWith('/uploads/')) {
      const relativePath = url.pathname.replace(/^\/uploads\/?/, '');
      const targetUrl = `${STORAGE_ORIGIN}/${relativePath}${url.search}`;
      return fetch(targetUrl, {
        method: 'GET',
        headers: cleanHeaders(request.headers),
      });
    }

    return env.ASSETS.fetch(request);
  },
};
