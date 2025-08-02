// Vercel API function for RazorSync work order operations
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extract work order ID from query parameters or URL
  const workOrderId = req.query.id || req.query.workorder;

  if (!workOrderId) {
    return res.status(400).json({ error: 'Work order ID is required' });
  }

  // RazorSync configuration using environment variables
  const RAZORSYNC_CONFIG = {
    token: process.env.VITE_RAZORSYNC_TOKEN,
    host: process.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
    serverName: process.env.VITE_RAZORSYNC_SERVER || 'vallus',
    baseUrl: `https://${process.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
  };

  if (!RAZORSYNC_CONFIG.token) {
    return res.status(500).json({ error: 'RazorSync token not configured' });
  }

  try {
    if (req.method === 'GET') {
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
      return res.status(200).json({ message: 'Work order found but response was not JSON' });

    } else if (req.method === 'POST') {
      // Handle PUT-like operations via POST for work order updates
      console.log(`📤 Server-side PUT request for work order ${workOrderId}`);
      
      const updateData = req.body;
      
      // Add modified date parameters that improve API success
      const now = new Date();
      const modifiedDate = `/Date(${now.getTime()})/`;
      
      // Clean the payload - only include RazorSync fields, remove Supabase-specific fields
      const payload = {
        // Core RazorSync fields
        Id: updateData.Id,
        CustomId: updateData.CustomId,
        Description: updateData.Description,
        StartDate: updateData.StartDate,
        EndDate: updateData.EndDate,
        StatusId: parseInt(updateData.StatusId), // Ensure numeric
        FieldWorkerId: updateData.FieldWorkerId,
        LocationId: updateData.LocationId,
        ActorId: updateData.ActorId,
        ServiceRequestId: updateData.ServiceRequestId,
        TaxNameId: updateData.TaxNameId,
        InvoicingMemo: updateData.InvoicingMemo,
        IsNotificationsDisable: updateData.IsNotificationsDisable,
        IdInContext: updateData.IdInContext,
        
        // Add modified date fields
        LastChangeDate: modifiedDate,
        ModifiedDate: modifiedDate
      };

      // Validate that StatusId is numeric
      if (isNaN(payload.StatusId)) {
        console.error(`❌ Invalid StatusId: ${updateData.StatusId} - must be numeric`);
        return res.status(400).json({ 
          error: `Invalid StatusId: ${updateData.StatusId} - must be numeric`,
          receivedStatusId: updateData.StatusId,
          statusIdType: typeof updateData.StatusId
        });
      }

      // Remove any null/undefined values and Supabase-specific fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === null || payload[key] === undefined) {
          delete payload[key];
        }
      });

      // Remove Supabase relationship fields that shouldn't be sent to RazorSync
      delete payload.rs_status_lookup;
      delete payload.fieldworkers;
      delete payload.CreatedDate;
      delete payload.CreateDate;

      const url = `${RAZORSYNC_CONFIG.baseUrl}/WorkOrder`;
      const headers = {
        'Content-Type': 'application/json',
        'Token': RAZORSYNC_CONFIG.token,
        'Host': RAZORSYNC_CONFIG.host,
        'ServerName': RAZORSYNC_CONFIG.serverName
      };

      console.log(`🔧 Updating work order ${workOrderId} with cleaned payload:`, {
        id: payload.Id,
        statusId: payload.StatusId,
        statusIdType: typeof payload.StatusId,
        originalStatusId: updateData.StatusId,
        originalStatusIdType: typeof updateData.StatusId,
        fieldCount: Object.keys(payload).length,
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
        console.error(`❌ Payload that caused error:`, JSON.stringify(payload, null, 2));
        return res.status(response.status).json({ 
          error: `RazorSync PUT Error: ${response.status} - ${errorText}`,
          debugInfo: {
            workOrderId,
            payloadFieldCount: Object.keys(payload).length,
            statusId: payload.StatusId
          }
        });
        });
      }

      // Handle successful update
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log(`✅ Successfully updated work order ${workOrderId}`);
        
        // Trigger n8n webhook to update Supabase data
        try {
          console.log(`🔄 Triggering n8n workflow to update Supabase...`);
          const webhookUrl = 'http://24.158.242.116:5678/webhook/672008ff-0465-4977-bbf7-426371c06bc6';
          const webhookResponse = await fetch(webhookUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (webhookResponse.ok) {
            console.log(`✅ n8n webhook triggered successfully`);
          } else {
            console.warn(`⚠️ n8n webhook returned ${webhookResponse.status}`);
          }
        } catch (webhookError) {
          console.error(`❌ Failed to trigger n8n webhook:`, webhookError);
          // Don't fail the main operation if webhook fails
        }
        
        return res.status(200).json({
          ...result,
          message: 'Work order updated successfully. Please refresh the list in 5 seconds to see updated data.',
          webhookTriggered: true
        });
      }

      console.log(`✅ Work order ${workOrderId} updated (non-JSON response)`);
      
      // Trigger n8n webhook for non-JSON responses too
      try {
        console.log(`🔄 Triggering n8n workflow to update Supabase...`);
        const webhookUrl = 'http://24.158.242.116:5678/webhook/672008ff-0465-4977-bbf7-426371c06bc6';
        const webhookResponse = await fetch(webhookUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (webhookResponse.ok) {
          console.log(`✅ n8n webhook triggered successfully`);
        } else {
          console.warn(`⚠️ n8n webhook returned ${webhookResponse.status}`);
        }
      } catch (webhookError) {
        console.error(`❌ Failed to trigger n8n webhook:`, webhookError);
        // Don't fail the main operation if webhook fails
      }
      
      return res.status(200).json({ 
        success: true,
        message: 'Work order updated successfully. Please refresh the list in 5 seconds to see updated data.',
        webhookTriggered: true
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

  } catch (error) {
    console.error('❌ API Route Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
