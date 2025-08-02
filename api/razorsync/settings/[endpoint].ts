// api/razorsync/settings/[endpoint].js
// Server-side proxy for RazorSync settings endpoints

export default async function handler(req, res) {
  const { endpoint } = req.query;
  const { method } = req;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }

  // RazorSync configuration
  const RAZORSYNC_CONFIG = {
    token: process.env.VITE_RAZORSYNC_TOKEN || '4442a145-bf1b-4cc4-bfd1-026587d5b037',
    host: process.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
    serverName: process.env.VITE_RAZORSYNC_SERVER || 'vallus',
    baseUrl: `https://${process.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
  };

  try {
    console.log(`📥 Server-side GET request for settings/${endpoint}`);
    
    const url = `${RAZORSYNC_CONFIG.baseUrl}/Settings/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Token': RAZORSYNC_CONFIG.token,
      'Host': RAZORSYNC_CONFIG.host,
      'ServerName': RAZORSYNC_CONFIG.serverName,
      'Connection': 'Keep-Alive'
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    console.log(`📊 RazorSync response for ${endpoint}: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ RazorSync Settings API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: `RazorSync Settings API Error: ${response.status} - ${errorText}` 
      });
    }

    // Handle empty response
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
      console.log(`⚠️ Settings ${endpoint} returned empty response`);
      return res.status(404).json({ 
        error: `Settings endpoint ${endpoint} not found or empty`,
        razorSyncResponse: 'empty'
      });
    }

    // Parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`✅ Successfully retrieved settings/${endpoint}`);
      return res.status(200).json(data);
    }

    console.log(`⚠️ Non-JSON response for settings/${endpoint}`);
    return res.status(200).json(null);

  } catch (error) {
    console.error('❌ Settings API Route Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
