const https = require('https');

// Simple in-memory store for cookies per user/session
const cookieStore = {};

function makeRequest(options, body = null, sessionId) {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    
    // Attach cookies if we have them for this session
    if (sessionId && cookieStore[sessionId]) {
      headers['Cookie'] = cookieStore[sessionId];
    }

    const req = https.request({ ...options, headers }, (res) => {
      let data = '';
      let setCookie = res.headers['set-cookie'] || '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Store cookies for this session
        if (sessionId && setCookie) {
          cookieStore[sessionId] = setCookie;
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
  const sessionId = req.headers['x-session-id'] || 'default-user';

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://fmi.34306.lol/',
    'Origin': 'https://fmi.34306.lol',
  };

  if (req.headers['x-fmi-browser']) {
    browserHeaders['X-FMI-Browser'] = req.headers['x-fmi-browser'];
  }

  try {
    const response = await makeRequest({
      hostname: 'fmi.34306.lol',
      path: urlPath,
      method: req.method,
      headers: browserHeaders
    }, req.method === 'POST' ? JSON.stringify(req.body) : null, sessionId);

    res.status(response.status).send(response.data);
  } catch (e) {
    res.status(500).json({ error: 'Proxy Error: ' + e.message });
  }
};
