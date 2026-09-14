// Forward fixture HTTP with the same cancellation lifetime as browser fetch.
// This keeps long-poll connection limits realistic during preview/navigation.
export async function forwardFixtureApi(route, target, page) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(target).hostname)) throw Error('Fixture proxy requires localhost.');
  const controller = new AbortController(); const request = route.request();
  const failed = value => { if (value === request) controller.abort(); }; const closed = () => controller.abort();
  page.on('requestfailed', failed); page.on('close', closed);
  try {
    const headers = { ...request.headers() }; delete headers.host; delete headers['content-length'];
    const response = await fetch(target, { method: request.method(), headers, ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}), signal: controller.signal, redirect: 'error' });
    const body = Buffer.from(await response.arrayBuffer());
    if (controller.signal.aborted || page.isClosed()) return;
    const responseHeaders = Object.fromEntries(response.headers); delete responseHeaders['content-encoding']; delete responseHeaders['content-length']; delete responseHeaders['transfer-encoding'];
    await route.fulfill({ status: response.status, headers: { ...responseHeaders, 'Access-Control-Allow-Origin': '*' }, body });
  } catch (error) { if (!controller.signal.aborted && !page.isClosed() && !request.failure()) throw error; }
  finally { page.off('requestfailed', failed); page.off('close', closed); }
}
