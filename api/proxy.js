const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-FMI-Browser');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extract the actual path after /api/proxy
  const urlPath = req.url.replace('/api/proxy', '');
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

  const options = {
    method: req.method,
    headers: browserHeaders,
  };

  const proxyReq = https.request(targetUrl, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(500).json({ error: 'Proxy Error: ' + err.message });
  });

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    proxyReq.end();
  }
};
