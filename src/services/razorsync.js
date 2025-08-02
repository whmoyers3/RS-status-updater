// services/razorsync.js
const RAZORSYNC_CONFIG = {
  token: import.meta.env.VITE_RAZORSYNC_TOKEN,
  host: import.meta.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
  serverName: import.meta.env.VITE_RAZORSYNC_SERVER || 'vallus',
  baseUrl: `https://${import.meta.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
}

// Base API call function with proper headers
const makeRazorSyncRequest = async (endpoint, method = 'GET', body = null) => {
  const url = `${RAZORSYNC_CONFIG.baseUrl}${endpoint}`
  
  const headers = {
    'Content-Type': 'application/json',
    'Token': RAZORSYNC_CONFIG.token,
    'Host': RAZORSYNC_CONFIG.host,
    'ServerName': RAZORSYNC_CONFIG.serverName,
    'Connection': 'Keep-Alive'
  }

  if (body && method !== 'GET') {
    headers['Content-Length'] = JSON.stringify(body).length.toString()
  }

  const config = {
    method,
    headers,
    ...(body && method !== 'GET' && { body: JSON.stringify(body) })
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`RazorSync API Error: ${response.status} - ${errorText}`)
    }
    // Some endpoints might return empty responses for successful operations
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return await response.json()
    }
    
    return null
  } catch (error) {
    console.error('RazorSync API Error:', error)
    throw error
  }
}

// Get work order details by ID
export const getWorkOrder = async (workOrderId) => {
  return makeRazorSyncRequest(`/WorkOrder/${workOrderId}`)
}

// Update work order status
export const updateWorkOrderStatus = async (workOrderId, statusId) => {
  const updateData = {
    Id: parseInt(workOrderId),
    StatusId: parseInt(statusId)
  }
  
  return makeRazorSyncRequest(`/WorkOrder`, 'PUT', updateData)
}

// Delete work order
export const deleteWorkOrder = async (workOrderId) => {
  return makeRazorSyncRequest(`/WorkOrder/${workOrderId}`, 'DELETE')
}

// Batch update work orders (sequential to avoid rate limiting)
export const batchUpdateWorkOrders = async (workOrderUpdates, onProgress = null) => {
  const results = []
  const total = workOrderUpdates.length
  
  for (let i = 0; i < workOrderUpdates.length; i++) {
    const { workOrderId, statusId } = workOrderUpdates[i]
    
    try {
      await updateWorkOrderStatus(workOrderId, statusId)
      results.push({ workOrderId, success: true, error: null })
      
      if (onProgress) {
        onProgress(i + 1, total)
      }
      
      // Add small delay to avoid overwhelming the API
      if (i < workOrderUpdates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      results.push({ 
        workOrderId, 
        success: false, 
        error: error.message 
      })
    }
  }
  
  return results
}
// Get available statuses (if RazorSync provides this endpoint)
export const getAvailableStatuses = async () => {
  try {
    return makeRazorSyncRequest('/Settings/Statuses')
  } catch (error) {
    // Fallback to predefined statuses if endpoint doesn't exist
    console.warn('Could not fetch statuses from RazorSync, using fallback')
    return []
  }
}

// Test API connection
export const testConnection = async () => {
  try {
    // Try a simple API call to test connectivity
    await makeRazorSyncRequest('/Settings/CompanyInfo')
    return { success: true, message: 'Connection successful' }
  } catch (error) {
    return { 
      success: false, 
      message: `Connection failed: ${error.message}` 
    }
  }
}

// Error handling utilities
export const handleRazorSyncError = (error) => {
  if (error.message.includes('400')) {
    return 'Invalid request data. Please check the work order ID and status.'
  } else if (error.message.includes('401')) {
    return 'Authentication failed. Please check your API token.'
  } else if (error.message.includes('404')) {
    return 'Work order not found in RazorSync.'
  } else if (error.message.includes('500')) {
    return 'RazorSync server error. Please try again later.'
  } else {
    return `RazorSync API error: ${error.message}`
  }
}