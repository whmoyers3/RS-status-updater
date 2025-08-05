// api/sync-webhook.js - Manual webhook trigger for data synchronization
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log(`🔄 Manual webhook trigger requested...`);
    
    // Trigger the n8n webhook for Supabase data sync
    const webhookUrl = 'http://24.158.242.116:5678/webhook/672008ff-0465-4977-bbf7-426371c06bc6';
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (webhookResponse.ok) {
      console.log(`✅ Manual webhook triggered successfully`);
      return res.status(200).json({
        success: true,
        message: 'Data sync webhook triggered successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn(`⚠️ Manual webhook returned ${webhookResponse.status}`);
      return res.status(webhookResponse.status).json({
        success: false,
        message: `Webhook returned status ${webhookResponse.status}`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`❌ Failed to trigger manual webhook:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to trigger webhook: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}