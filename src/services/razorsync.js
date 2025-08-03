// services/razorsync.js - Updated to use Vercel API routes for server-to-server communication
// Import Supabase functions for field worker validation
import { getFieldworkers } from './supabase.js'

const RAZORSYNC_CONFIG = {
  token: import.meta.env.VITE_RAZORSYNC_TOKEN,
  host: import.meta.env.VITE_RAZORSYNC_HOST || 'vallus.0.razorsync.com',
  serverName: import.meta.env.VITE_RAZORSYNC_SERVER || 'vallus',
  baseUrl: `https://${import.meta.env.VITE_RAZORSYNC_SERVER || 'vallus'}.0.razorsync.com/ApiService.svc`,
  // Use Vercel API routes to bypass CORS
  apiBaseUrl: '/api'
}

// Base API call function using Vercel API routes
const makeRazorSyncRequest = async (workOrderId, method = 'GET', body = null) => {
  // Use simple Vercel API routes
  const url = `/api/workorder?id=${workOrderId}`
  
  const headers = {
    'Content-Type': 'application/json'
  }

  const config = {
    method: method === 'PUT' ? 'POST' : method, // Use POST for updates
    headers,
    ...(body && { body: JSON.stringify(body) })
  }

  try {
    console.log(`🌐 Vercel API ${method} ${url}:`, body ? 'with data' : 'no data')
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`❌ Vercel API Error: ${response.status} - ${errorData.error}`)
      throw new Error(`API Error: ${response.status} - ${errorData.error}`)
    }
    
    const result = await response.json()
    console.log(`✅ Vercel API ${method} success:`, result ? 'data received' : 'no data')
    return result
    
  } catch (error) {
    console.error('❌ Vercel API Error:', error)
    throw error
  }
}

// Get work order details by RazorSync ID
export const getWorkOrder = async (workOrderId) => {
  try {
    const result = await makeRazorSyncRequest(workOrderId, 'GET')
    return result
  } catch (error) {
    console.error(`Failed to get work order ${workOrderId}:`, error.message)
    
    // Check if it's a 404 (not found) error
    if (error.message.includes('404')) {
      throw new Error(`Work order ${workOrderId} not found in RazorSync`)
    }
    
    // For other errors, wrap them
    throw new Error(`Failed to fetch work order ${workOrderId}: ${error.message}`)
  }
}
// IMPROVED: 2-step API update using RazorSync ID with deactivated field worker handling
export const updateWorkOrderStatus = async (razorSyncId, statusId) => {
  console.log(`🔄 Starting 2-step update for RazorSync ID ${razorSyncId} to status ${statusId}`)
  
  // Ensure statusId is numeric
  const numericStatusId = parseInt(statusId)
  if (isNaN(numericStatusId)) {
    throw new Error(`Invalid status ID: ${statusId} - must be numeric`)
  }
  
  console.log(`✅ Status ID validation: ${statusId} -> ${numericStatusId}`)
  
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
      currentStatusType: typeof currentWorkOrder.StatusId,
      currentFieldWorker: currentWorkOrder.FieldWorkerId,
      description: currentWorkOrder.Description?.substring(0, 50) + '...'
    })
    
    // Validation: Ensure we got the right work order
    if (currentWorkOrder.Id !== parseInt(razorSyncId)) {
      throw new Error(`API returned wrong work order: expected ${razorSyncId}, got ${currentWorkOrder.Id}`)
    }
    
    // STEP 1.5: Check for deactivated field worker and handle auto-reassignment
    console.log(`🔍 Checking field worker status for ID ${currentWorkOrder.FieldWorkerId}...`)
    
    // Get list of active fieldworkers from Supabase
    const fieldworkers = await getFieldworkers()
    const activeFieldWorkerIds = fieldworkers.map(fw => fw.id)
    const isFieldWorkerActive = activeFieldWorkerIds.includes(currentWorkOrder.FieldWorkerId)
    
    let updateData = { ...currentWorkOrder }
    
    if (!isFieldWorkerActive && currentWorkOrder.FieldWorkerId !== 1) {
      console.log(`⚠️ Field worker ${currentWorkOrder.FieldWorkerId} is deactivated. Auto-reassigning to Field Worker 1...`)
      
      // Auto-reassign to Field Worker 1 (active user)
      updateData.FieldWorkerId = 1
      
      // Append note to description about the field worker change
      const originalDescription = currentWorkOrder.Description || ''
      const fieldWorkerNote = ` (changed from FW ${currentWorkOrder.FieldWorkerId})`
      
      // Only append if not already noted to avoid duplicate notes
      if (!originalDescription.includes(`(changed from FW ${currentWorkOrder.FieldWorkerId})`)) {
        updateData.Description = originalDescription + fieldWorkerNote
      }
      
      console.log(`✅ Auto-reassignment prepared:`, {
        originalFieldWorker: currentWorkOrder.FieldWorkerId,
        newFieldWorker: updateData.FieldWorkerId,
        descriptionUpdated: updateData.Description !== originalDescription,
        newDescription: updateData.Description?.substring(0, 100) + '...'
      })
    } else {
      console.log(`✅ Field worker ${currentWorkOrder.FieldWorkerId} is active. No reassignment needed.`)
    }
    
    // STEP 2: API PUT - Update status while preserving ALL other fields exactly as returned
    console.log(`📤 Step 2: Updating work order ${razorSyncId} status from ${currentWorkOrder.StatusId} to ${numericStatusId}...`)
    
    // Only change the status to the numeric value (and potentially field worker + description if auto-reassigned)
    updateData.StatusId = numericStatusId
    
    console.log(`🔧 Update payload prepared:`, {
      id: updateData.Id,
      customId: updateData.CustomId,
      oldStatus: currentWorkOrder.StatusId,
      oldStatusType: typeof currentWorkOrder.StatusId,
      newStatus: updateData.StatusId,
      newStatusType: typeof updateData.StatusId,
      oldFieldWorker: currentWorkOrder.FieldWorkerId,
      newFieldWorker: updateData.FieldWorkerId,
      fieldWorkerChanged: updateData.FieldWorkerId !== currentWorkOrder.FieldWorkerId,
      descriptionChanged: updateData.Description !== currentWorkOrder.Description,
      fieldsCount: Object.keys(updateData).length
    })
    
    const updateResult = await makeRazorSyncRequest(razorSyncId, 'PUT', updateData)
    
    console.log(`✅ Step 2 Success: Updated work order ${razorSyncId} status to ${numericStatusId}`)
    
    // Check if webhook was triggered for Supabase sync
    if (updateResult && updateResult.webhookTriggered) {
      console.log(`🔄 n8n webhook triggered to sync Supabase data`)
    }
    
    return {
      success: true,
      workOrderId: razorSyncId,
      customId: currentWorkOrder.CustomId,
      oldStatus: currentWorkOrder.StatusId,
      newStatus: numericStatusId,
      oldFieldWorker: currentWorkOrder.FieldWorkerId,
      newFieldWorker: updateData.FieldWorkerId,
      fieldWorkerReassigned: updateData.FieldWorkerId !== currentWorkOrder.FieldWorkerId,
      updateResult,
      message: updateResult?.message || 'Work order updated successfully'
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

// Delete work order (not implemented in current API route)
export const deleteWorkOrder = async (workOrderId) => {
  throw new Error('Delete functionality not yet implemented in API route')
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

// Get available statuses (fallback to predefined)
export const getAvailableStatuses = async () => {
  console.warn('Status fetching not yet implemented in API route, using fallback')
  return []
}

// Test API connection (basic test)
export const testConnection = async () => {
  try {
    // Try to get a known work order to test connectivity
    await getWorkOrder('60254')
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
