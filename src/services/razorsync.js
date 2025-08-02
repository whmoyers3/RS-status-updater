// services/razorsync.js
const RAZORSYNC_CONFIG = {
  token: import.meta.env.VITE_RAZORSYNC_TOKEN,
  host: import.meta.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
  serverName: import.meta.env.VITE_RAZORSYNC_SERVER || 'vallus',
  baseUrl: `https://${import.meta.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`
}

// Base API call function with proper headers and enhanced logging
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
    console.log(`🌐 RazorSync ${method} ${endpoint}:`, body ? 'with data' : 'no data')
    console.log(`📡 Full URL: ${url}`)
    console.log(`📋 Headers:`, headers)
    
    const response = await fetch(url, config)
    
    console.log(`📊 Response received:`)
    console.log(`   - Status: ${response.status}`)
    console.log(`   - OK: ${response.ok}`)
    console.log(`   - Status Text: ${response.statusText}`)
    console.log(`   - Content-Type: ${response.headers.get('content-type')}`)
    console.log(`   - Content-Length: ${response.headers.get('content-length')}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ RazorSync API Error: ${response.status} - ${errorText}`)
      throw new Error(`RazorSync API Error: ${response.status} - ${errorText}`)
    }
    
    // Check for empty response (common when work order doesn't exist)
    const contentLength = response.headers.get('content-length')
    if (contentLength === '0') {
      console.log(`⚠️ RazorSync ${method} ${endpoint}: Empty response (likely not found)`)
      return null
    }
    
    // Some endpoints might return empty responses for successful operations
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json()
      console.log(`✅ RazorSync ${method} ${endpoint} success:`, result ? 'data received' : 'no data')
      console.log(`📦 Actual data:`, result)
      return result
    }
    
    console.log(`✅ RazorSync ${method} ${endpoint} success: non-JSON response`)
    return null
  } catch (error) {
    console.error('❌ RazorSync API Error:', error)
    throw error
  }
}

// Get work order details by RazorSync ID
export const getWorkOrder = async (workOrderId) => {
  try {
    const result = await makeRazorSyncRequest(`/WorkOrder/${workOrderId}`)
    
    // Handle the case where RazorSync returns empty response for non-existent work orders
    if (!result) {
      throw new Error(`Work order ${workOrderId} not found in RazorSync (empty response)`)
    }
    
    return result
  } catch (error) {
    console.error(`Failed to get work order ${workOrderId}:`, error.message)
    
    // If it's already our "not found" error, re-throw as is
    if (error.message.includes('not found in RazorSync')) {
      throw error
    }
    
    // For other errors, wrap them
    throw new Error(`Failed to fetch work order ${workOrderId}: ${error.message}`)
  }
}

// IMPROVED: 2-step API update using RazorSync ID (recommended approach)
export const updateWorkOrderStatus = async (razorSyncId, statusId) => {
  console.log(`🔄 Starting 2-step update for RazorSync ID ${razorSyncId} to status ${statusId}`)
  
  try {
    // STEP 1: API GET - Fetch current work order data using RazorSync ID
    console.log(`📥 Step 1: Fetching work order ${razorSyncId} from RazorSync API...`)
    
    let currentWorkOrder
    try {
      currentWorkOrder = await getWorkOrder(razorSyncId)
    } catch (error) {
      // Handle specific "not found" errors more gracefully
      if (error.message.includes('not found in RazorSync')) {
        throw new Error(`Work order ${razorSyncId} not found in RazorSync`)
      }
      throw error
    }
    
    if (!currentWorkOrder) {
      throw new Error(`Work order ${razorSyncId} not found in RazorSync`)
    }
    
    console.log(`✅ Step 1 Success: Retrieved work order ${razorSyncId}`, {
      id: currentWorkOrder.Id,
      customId: currentWorkOrder.CustomId,
      currentStatus: currentWorkOrder.StatusId,
      description: currentWorkOrder.Description?.substring(0, 50) + '...'
    })
    
    // Validation: Ensure we got the right work order
    if (currentWorkOrder.Id !== parseInt(razorSyncId)) {
      throw new Error(`API returned wrong work order: expected ${razorSyncId}, got ${currentWorkOrder.Id}`)
    }
    
    // STEP 2: API PUT - Update status while preserving ALL other fields exactly as returned
    console.log(`📤 Step 2: Updating work order ${razorSyncId} status from ${currentWorkOrder.StatusId} to ${statusId}...`)
    
    const updateData = {
      // Preserve ALL fields exactly as returned by the API
      ...currentWorkOrder,
      // Only change the status
      StatusId: parseInt(statusId)
    }
    
    // Remove any read-only fields that shouldn't be sent back
    delete updateData.CreatedDate
    delete updateData.ModifiedDate
    delete updateData.LastModifiedDate
    
    console.log(`🔧 Update payload prepared:`, {
      id: updateData.Id,
      customId: updateData.CustomId,
      oldStatus: currentWorkOrder.StatusId,
      newStatus: updateData.StatusId,
      fieldsCount: Object.keys(updateData).length
    })
    
    const updateResult = await makeRazorSyncRequest(`/WorkOrder`, 'PUT', updateData)
    
    console.log(`✅ Step 2 Success: Updated work order ${razorSyncId} status to ${statusId}`)
    
    return {
      success: true,
      workOrderId: razorSyncId,
      customId: currentWorkOrder.CustomId,
      oldStatus: currentWorkOrder.StatusId,
      newStatus: parseInt(statusId),
      updateResult
    }
    
  } catch (error) {
    console.error(`❌ 2-step update failed for work order ${razorSyncId}:`, error)
    
    // Enhanced error reporting
    const enhancedError = new Error(
      `Failed to update work order ${razorSyncId}: ${error.message}`
    )
    enhancedError.originalError = error
    enhancedError.workOrderId = razorSyncId
    enhancedError.targetStatus = statusId
    
    throw enhancedError
  }
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
