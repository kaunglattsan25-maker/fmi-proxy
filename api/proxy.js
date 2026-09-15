const https = require('https');

// Store cookies in memory (Note: In production, use Redis for multiple users)
const cookieJar = {};

function makeRequest(options, body = null, cookieStore = null) {
  return new Promise((resolve, reject) => {
    // Add stored cookies to the request
    if (cookieStore && cookieStore.cookies) {
      options.headers = { ...options.headers, 'Cookie': cookieStore.cookies };
    }

    const req = https.request(options, (res) => {
      let data = '';
      let setCookieHeader = res.headers['set-cookie'] || '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Save cookies for future requests
        if (cookieStore && setCookieHeader) {
          cookieStore.cookies = setCookieHeader;
        }
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
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
  
  // Use a simple in-memory store based on the request's IP or a custom ID
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const store = cookieJar[clientIp] || (cookieJar[clientIp] = { cookies: '' });

  if (urlPath === '/full-check') {
    try {
      let body = '';
      if (req.method === 'POST') {
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
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fmi.34306.lol/',
        'Origin': 'https://fmi.34306.lol',
      };

      // 1. Get Token and capture cookies
      const sessionRes = await makeRequest({
        hostname: 'fmi.34306.lol',
        path: '/api/session',
        method: 'GET',
        headers: browserHeaders
      }, null, store);
      
      const { token } = JSON.parse(sessionRes.data);

      // 2. Submit Check using token AND cookies
      const checkRes = await makeRequest({
        hostname: 'fmi.34306.lol',
        path: '/api/check',
        method: 'POST',
        headers: { ...browserHeaders, 'X-FMI-Browser': token, 'Content-Type': 'application/json' },
      }, JSON.stringify({ query }), store);

      res.status(checkRes.status).send(checkRes.data);
    } catch (e) {
      res.status(500).json({ error: 'Internal Proxy Error: ' + e.message });
    }
    return;
  }

  // Standard proxy for polling
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
