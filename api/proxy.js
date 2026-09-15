const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Allow requests from your mobile app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-FMI-Browser');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const targetUrl = 'https://fmi.34306.lol';
  const path = req.url.replace('/api/proxy', ''); // Remove prefix
  const url = `${targetUrl}${path}`;

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://fmi.34306.lol/',
    'Origin': 'https://fmi.34306.lol',
  };

  // Add the token if the app sent it
  if (req.headers['x-fmi-browser']) {
    browserHeaders['X-FMI-Browser'] = req.headers['x-fmi-browser'];
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: browserHeaders,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy Error: ' + error.message });
  }
};
