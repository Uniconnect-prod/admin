/**
 * Local SYNTHETIC platform API for development and demos (never use in production).
 *
 *   npm run mock:platform-api            → http://127.0.0.1:5055
 *
 * ALPHA (GHSuperWinnings-style):  base URL http://127.0.0.1:5055/api
 *   login  POST /admin/login   { "email": "reporting@alpha.example.test", "password": "alpha-test-password" }
 *   report GET  /admin/dashboard?fromDate&toDate&report&page&limit
 * BETA (different vendor style):  base URL http://127.0.0.1:5055
 *   report GET  /v2/reports/kpis?start_date=DD/MM/YYYY&end_date&type&offset&per_page   header X-Api-Key: beta-key-456
 *
 * The reporting server only reaches this when started with
 *   OUTBOUND_ALLOW_PRIVATE_HOSTS=127.0.0.1:5055 OUTBOUND_ALLOW_HTTP_HOSTS=127.0.0.1:5055
 * (npm run dev:memory sets these automatically).
 */
import http from 'node:http';
import { mockPlatformHandler } from '../test/fixtures/mockPlatformApi.js';

const PORT = parseInt(process.env.MOCK_API_PORT || '5055', 10);

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 100000) req.destroy();
  });
  req.on('end', () => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const out = mockPlatformHandler({ method: req.method, url, headers: req.headers, body });
    res.writeHead(out.status, out.headers);
    res.end(out.body);
    console.log(`[mock-api] ${req.method} ${url.pathname}${url.search} → ${out.status}`);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-api] SYNTHETIC platform API listening on http://127.0.0.1:${PORT} (development only)`);
});
