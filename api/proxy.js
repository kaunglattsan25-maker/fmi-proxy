const https = require('https');

// Helper function to make HTTPS requests
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-FMI-Browser');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const urlPath = req.url.replace('/api/proxy', '');

  // SPECIAL ENDPOINT: /full-check
  if (urlPath === '/full-check') {
    try {
      let body = '';
      if (req.method === 'POST') {
        // Collect body for the query
        const bodyPromise = new Promise(resolve => {
          req.on('data', chunk => body += chunk);
          req.on('end', resolve);
        });
        await bodyPromise;
      }

      const queryData = JSON.parse(body || '{}');
      const query = queryData.query;

      if (!query) return res.status(400).json({ detail: 'Query is required' });

      const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://fmi.34306.lol/',
        'Origin': 'https://fmi.34306.lol',
      };

      // 1. Get Token
      const sessionRes = await makeRequest({
        hostname: 'fmi.34306.lol',
        path: '/api/session',
        method: 'GET',
        headers: browserHeaders
      });
      const { token } = JSON.parse(sessionRes.data);

      // 2. Submit Check immediately using that token
      const checkRes = await makeRequest({
        hostname: 'fmi.34306.lol',
        path: '/api/check',
        method: 'POST',
        headers: { ...browserHeaders, 'X-FMI-Browser': token, 'Content-Type': 'application/json' },
      }, JSON.stringify({ query }));

      res.status(checkRes.status).send(checkRes.data);
    } catch (e) {
      res.status(500).json({ error: 'Internal Proxy Error: ' + e.message });
    }
    return;
  }

  // Regular proxy for other calls (like polling)
  const targetUrl = `https://fmi.34306.lol${urlPath}`;
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://fmi.34306.lol/',
    'Origin': 'https://fmi.34306.lol',
  };

  if (req.headers['x-fmi-browser']) {
    browserHeaders['X-FMI-Browser'] = req.headers['x-fmi-browser'];
  }

  const options = { method: req.method, headers: browserHeaders };
  const proxyReq = https.request(targetUrl, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => res.status(500).json({ error: err.message }));
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { proxyReq.write(body); proxyReq.end(); });
  } else {
    proxyReq.end();
  }
};
