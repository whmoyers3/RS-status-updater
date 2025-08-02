// Simple test API route
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'API is working!', 
      timestamp: new Date().toISOString(),
      env: {
        hasToken: !!process.env.VITE_RAZORSYNC_TOKEN,
        hasHost: !!process.env.VITE_RAZORSYNC_HOST,
        hasServer: !!process.env.VITE_RAZORSYNC_SERVER
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
