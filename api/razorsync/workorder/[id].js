// api/razorsync/workorder/[id].js
// Vercel API route for server-to-server RazorSync communication
// This bypasses CORS issues by making requests from the server

export default async function handler(req, res) {
  const { id } = req.query;
  const { method } = req;

  // CORS headers for browser requests to this API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // RazorSync configuration
  const RAZORSYNC_CONFIG = {
    token: process.env.VITE_RAZORSYNC_TOKEN || '4442a145-bf1b-4cc4-bfd1-026587d5b037',
    host: process.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
    serverName: process.env.VITE_RAZORSYNC_SERVER || 'vallus',
    baseUrl: `https://${process.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
  };

  try {
    if (method === 'GET') {
      // GET work order by ID
      console.log(`📥 Server-side GET request for work order ${id}`);
      
      const url = `${RAZORSYNC_CONFIG.baseUrl}/WorkOrder/${id}`;
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
        console.log(`⚠️ Work order ${id} not found (empty response)`);
        return res.status(404).json({ 
          error: `Work order ${id} not found in RazorSync`,
          razorSyncResponse: 'empty'
        });
      }

      // Parse JSON response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log(`✅ Successfully retrieved work order ${id}`);
        return res.status(200).json(data);
      }

      console.log(`⚠️ Non-JSON response for work order ${id}`);
      return res.status(200).json(null);

    } else if (method === 'PUT') {
      // PUT work order update
      console.log(`📤 Server-side PUT request for work order ${id}`);
      
      const updateData = req.body;
      
      // Add modified date parameters that you mentioned work
      const now = new Date();
      const modifiedDate = `/Date(${now.getTime()})/`;
      
      const payload = {
        ...updateData,
        // Include modified date fields that help with API success
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
        'ServerName': RAZORSYNC_CONFIG.serverName,
        'Connection': 'Keep-Alive',
        'Content-Length': JSON.stringify(payload).length.toString()
      };

      console.log(`🔧 Updating work order ${id} with payload:`, {
        id: payload.Id,
        statusId: payload.StatusId,
        hasModifiedDate: !!payload.LastChangeDate
      });

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
        console.log(`✅ Successfully updated work order ${id}`);
        return res.status(200).json(result);
      }

      console.log(`✅ Work order ${id} updated (non-JSON response)`);
      return res.status(200).json({ success: true });

    } else {
      res.setHeader('Allow', ['GET', 'PUT', 'OPTIONS']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }

  } catch (error) {
    console.error('❌ API Route Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
