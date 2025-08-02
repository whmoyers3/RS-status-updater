// Simple debug version of workorder API route
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extract work order ID from query parameters
    const workOrderId = req.query.id || req.query.workorder;

    if (!workOrderId) {
      return res.status(400).json({ error: 'Work order ID is required' });
    }

    console.log(`🔍 Debug: Received request for work order ${workOrderId}`);

    // RazorSync configuration
    const RAZORSYNC_CONFIG = {
      token: process.env.VITE_RAZORSYNC_TOKEN,
      host: process.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
      serverName: process.env.VITE_RAZORSYNC_SERVER || 'vallus',
      baseUrl: `https://${process.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
    };

    if (!RAZORSYNC_CONFIG.token) {
      console.error('❌ Missing RazorSync token');
      return res.status(500).json({ error: 'RazorSync token not configured' });
    }

    console.log(`🔧 Using RazorSync config: ${RAZORSYNC_CONFIG.baseUrl}`);

    if (req.method === 'GET') {
      console.log(`📥 GET request for work order ${workOrderId}`);
      
      const url = `${RAZORSYNC_CONFIG.baseUrl}/WorkOrder/${workOrderId}`;
      console.log(`🔗 Fetching URL: ${url}`);
      
      const headers = {
        'Content-Type': 'application/json',
        'Token': RAZORSYNC_CONFIG.token,
        'Host': RAZORSYNC_CONFIG.host,
        'ServerName': RAZORSYNC_CONFIG.serverName
      };

      console.log(`📋 Headers:`, { ...headers, Token: '***hidden***' });

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log(`📊 RazorSync response: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ RazorSync API Error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ 
          error: `RazorSync API Error: ${response.status} - ${errorText}`,
          url,
          workOrderId
        });
      }

      // Handle empty response
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        console.log(`⚠️ Work order ${workOrderId} not found (empty response)`);
        return res.status(404).json({ 
          error: `Work order ${workOrderId} not found in RazorSync`,
          razorSyncResponse: 'empty'
        });
      }

      // Parse JSON response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log(`✅ Successfully retrieved work order ${workOrderId}`);
        return res.status(200).json(data);
      }

      console.log(`⚠️ Non-JSON response for work order ${workOrderId}`);
      return res.status(200).json({ message: 'Work order found but response was not JSON' });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

  } catch (error) {
    console.error('❌ Unhandled error in API route:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    });
  }
}
