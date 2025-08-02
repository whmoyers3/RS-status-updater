// Simple API route for getting work orders
export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { workorder } = req.query;

  if (req.method === 'GET') {
    const workOrderId = workorder;
    
    if (!workOrderId) {
      return res.status(400).json({ error: 'Work order ID is required' });
    }

    // RazorSync configuration
    const RAZORSYNC_CONFIG = {
      token: process.env.VITE_RAZORSYNC_TOKEN || '4442a145-bf1b-4cc4-bfd1-026587d5b037',
      host: process.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
      serverName: process.env.VITE_RAZORSYNC_SERVER || 'vallus',
      baseUrl: `https://${process.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
    };

    try {
      console.log(`📥 Server-side GET request for work order ${workOrderId}`);
      
      const url = `${RAZORSYNC_CONFIG.baseUrl}/WorkOrder/${workOrderId}`;
      const headers = {
        'Content-Type': 'application/json',
        'Token': RAZORSYNC_CONFIG.token,
        'Host': RAZORSYNC_CONFIG.host,
        'ServerName': RAZORSYNC_CONFIG.serverName
      };

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log(`📊 RazorSync response: ${response.status}, Content-Length: ${response.headers.get('content-length')}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ RazorSync API Error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ 
          error: `RazorSync API Error: ${response.status} - ${errorText}` 
        });
      }

      // Handle empty response (work order not found)
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
      return res.status(200).json(null);

    } catch (error) {
      console.error('❌ API Route Error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  } 

  else if (req.method === 'POST') {
    // Handle PUT-like operations via POST
    const workOrderId = workorder;
    const updateData = req.body;
    
    if (!workOrderId) {
      return res.status(400).json({ error: 'Work order ID is required' });
    }

    // RazorSync configuration
    const RAZORSYNC_CONFIG = {
      token: process.env.VITE_RAZORSYNC_TOKEN || '4442a145-bf1b-4cc4-bfd1-026587d5b037',
      host: process.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
      serverName: process.env.VITE_RAZORSYNC_SERVER || 'vallus',
      baseUrl: `https://${process.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
    };

    try {
      console.log(`📤 Server-side PUT request for work order ${workOrderId}`);
      
      // Add modified date parameters
      const now = new Date();
      const modifiedDate = `/Date(${now.getTime()})/`;
      
      const payload = {
        ...updateData,
        LastChangeDate: modifiedDate,
        ModifiedDate: modifiedDate
      };

      // Remove any fields that shouldn't be sent back
      delete payload.CreatedDate;
      delete payload.CreateDate;

      const url = `${RAZORSYNC_CONFIG.baseUrl}/WorkOrder`;
      const headers = {
        'Content-Type': 'application/json',
        'Token': RAZORSYNC_CONFIG.token,
        'Host': RAZORSYNC_CONFIG.host,
        'ServerName': RAZORSYNC_CONFIG.serverName
      };

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });

      console.log(`📊 RazorSync PUT response: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ RazorSync PUT Error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ 
          error: `RazorSync PUT Error: ${response.status} - ${errorText}` 
        });
      }

      // Handle successful update
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log(`✅ Successfully updated work order ${workOrderId}`);
        return res.status(200).json(result);
      }

      console.log(`✅ Work order ${workOrderId} updated (non-JSON response)`);
      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('❌ Update API Route Error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}
