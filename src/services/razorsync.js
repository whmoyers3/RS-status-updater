// services/razorsync.js - FIXED VERSION
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
const makeRazorSyncRequest = async (workOrderId, method = 'GET', body = null, skipWebhook = false) => {
  // Use simple Vercel API routes
  const url = `/api/workorder?id=${workOrderId}${skipWebhook ? '&skipWebhook=true' : ''}`
  
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

// FIXED: Single work order update with proper field worker validation
export const updateWorkOrderStatus = async (razorSyncId, statusId, updaterInfo = null, skipWebhook = false) => {
  console.log(`🔄 Starting update for RazorSync ID ${razorSyncId} to status ${statusId}${skipWebhook ? ' (skipping webhook)' : ''}`)
  
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
      currentFieldWorker: currentWorkOrder.FieldWorkerId,
      fieldWorkerType: typeof currentWorkOrder.FieldWorkerId,
      description: currentWorkOrder.Description?.substring(0, 50) + '...'
    })
    
    // Validation: Ensure we got the right work order
    if (currentWorkOrder.Id !== parseInt(razorSyncId)) {
      throw new Error(`API returned wrong work order: expected ${razorSyncId}, got ${currentWorkOrder.Id}`)
    }
    
    // STEP 1.5: FIXED Field Worker Validation - Only change if unassigned or deactivated
    console.log(`🔍 Checking field worker status for ID ${currentWorkOrder.FieldWorkerId}...`)
    
    // Get list of active fieldworkers from Supabase
    const fieldworkers = await getFieldworkers()
    const activeFieldWorkerIds = fieldworkers.map(fw => parseInt(fw.id)) // Ensure all IDs are numbers
    
    let updateData = { ...currentWorkOrder }
    let fieldWorkerChanged = false
    
    // FIXED LOGIC: Only reassign if field worker is null, undefined, 0, or not in active list
    const currentFWId = parseInt(currentWorkOrder.FieldWorkerId) // Convert to number for comparison
    const isUnassigned = !currentWorkOrder.FieldWorkerId || currentWorkOrder.FieldWorkerId === 0 || currentWorkOrder.FieldWorkerId === null || currentWorkOrder.FieldWorkerId === undefined
    const isDeactivated = currentWorkOrder.FieldWorkerId && !activeFieldWorkerIds.includes(currentFWId)
    
    console.log(`🔍 Field Worker Analysis:`, {
      originalFieldWorkerId: currentWorkOrder.FieldWorkerId,
      originalFieldWorkerIdType: typeof currentWorkOrder.FieldWorkerId,
      currentFWId,
      currentFWIdType: typeof currentFWId,
      isUnassigned,
      isDeactivated,
      activeFieldWorkerIds: activeFieldWorkerIds.slice(0, 10), // Show first 10 for debugging
      totalActiveFieldworkers: activeFieldWorkerIds.length,
      shouldReassign: isUnassigned || isDeactivated,
      isInActiveList: activeFieldWorkerIds.includes(currentFWId)
    })
    
    if (isUnassigned || isDeactivated) {
      console.log(`⚠️ Field worker reassignment needed: ${isUnassigned ? 'Unassigned' : 'Deactivated'} (${currentFWId}). Auto-reassigning to Field Worker 1...`)
      
      // Auto-reassign to Field Worker 1 (active user)
      updateData.FieldWorkerId = 1
      fieldWorkerChanged = true
      
      // Append note to description about the field worker change if deactivated
      if (isDeactivated) {
        const originalDescription = currentWorkOrder.Description || ''
        const fieldWorkerNote = ` (reassigned from deactivated FW ${currentFWId})`
        
        // Only append if not already noted to avoid duplicate notes
        if (!originalDescription.includes(`(reassigned from deactivated FW ${currentFWId})`)) {
          updateData.Description = originalDescription + fieldWorkerNote
        }
      }
      
      console.log(`✅ Field worker reassignment prepared:`, {
        originalFieldWorker: currentFWId,
        newFieldWorker: updateData.FieldWorkerId,
        reason: isUnassigned ? 'unassigned' : 'deactivated',
        descriptionUpdated: updateData.Description !== currentWorkOrder.Description
      })
    } else {
      console.log(`✅ Field worker ${currentFWId} is active and assigned. No reassignment needed.`)
    }
    
    // STEP 2: API PUT - Update status while preserving ALL other fields exactly as returned
    console.log(`📤 Step 2: Updating work order ${razorSyncId} status from ${currentWorkOrder.StatusId} to ${numericStatusId}...`)
    
    // Only change the status to the numeric value (and potentially field worker + description if reassigned)
    updateData.StatusId = numericStatusId
    
    // Add updater information if provided
    if (updaterInfo) {
      // Add updater fields to payload for API tracking
      updateData.UpdaterId = updaterInfo.id;
      updateData.UpdaterName = updaterInfo.name;
      
      // Add updater note to description for visual tracking
      const updaterNote = ` (updated by ${updaterInfo.name || updaterInfo.id} on ${new Date().toLocaleDateString()})`
      if (!updateData.Description?.includes(updaterNote)) {
        updateData.Description = (updateData.Description || '') + updaterNote
      }
    }
    
    console.log(`🔧 Update payload prepared:`, {
      id: updateData.Id,
      customId: updateData.CustomId,
      oldStatus: currentWorkOrder.StatusId,
      newStatus: updateData.StatusId,
      oldFieldWorker: currentWorkOrder.FieldWorkerId,
      newFieldWorker: updateData.FieldWorkerId,
      fieldWorkerChanged,
      descriptionChanged: updateData.Description !== currentWorkOrder.Description,
      fieldsCount: Object.keys(updateData).length,
      hasUpdaterInfo: !!(updateData.UpdaterId || updateData.UpdaterName),
      updaterId: updateData.UpdaterId,
      updaterName: updateData.UpdaterName,
      skipWebhook
    })
    
    const updateResult = await makeRazorSyncRequest(razorSyncId, 'PUT', updateData, skipWebhook)
    
    console.log(`✅ Step 2 Success: Updated work order ${razorSyncId} status to ${numericStatusId}`)
    
    return {
      success: true,
      workOrderId: razorSyncId,
      customId: currentWorkOrder.CustomId,
      oldStatus: currentWorkOrder.StatusId,
      newStatus: numericStatusId,
      oldFieldWorker: currentWorkOrder.FieldWorkerId,
      newFieldWorker: updateData.FieldWorkerId,
      fieldWorkerReassigned: fieldWorkerChanged,
      updateResult,
      webhookSkipped: skipWebhook,
      message: updateResult?.message || 'Work order updated successfully'
    }
    
  } catch (error) {
    console.error(`❌ Update failed for work order ${razorSyncId}:`, error)
    
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

// FIXED: Batch update with configurable timing and single webhook at end
export const batchUpdateWorkOrders = async (workOrderUpdates, options = {}) => {
  const {
    onProgress = null,
    delayBetweenRequests = 1000, // Default 1 second between requests
    updaterInfo = null
  } = options
  
  const results = []
  const total = workOrderUpdates.length
  
  console.log(`🚀 Starting batch update of ${total} work orders with ${delayBetweenRequests}ms delay between requests`)
  
  // Process all updates with skipWebhook = true (except the last one)
  for (let i = 0; i < workOrderUpdates.length; i++) {
    const { workOrderId, statusId } = workOrderUpdates[i]
    const isLastUpdate = i === workOrderUpdates.length - 1
    
    try {
      console.log(`📝 Processing ${i + 1}/${total}: Work Order ${workOrderId}`)
      
      // Skip webhook for all but the last update
      await updateWorkOrderStatus(workOrderId, statusId, updaterInfo, !isLastUpdate)
      
      results.push({ workOrderId, success: true, error: null })
      
      if (onProgress) {
        onProgress(i + 1, total)
      }
      
      // Add delay between requests (but not after the last one)
      if (i < workOrderUpdates.length - 1) {
        console.log(`⏱️ Waiting ${delayBetweenRequests}ms before next request...`)
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))
      }
    } catch (error) {
      console.error(`❌ Failed to update work order ${workOrderId}:`, error.message)
      results.push({ 
        workOrderId, 
        success: false, 
        error: error.message 
      })
    }
  }
  
  console.log(`✅ Batch update completed. ${results.filter(r => r.success).length}/${total} successful. Webhook triggered with final update.`)
  
  return results
}

// Trigger manual webhook (for cases where we need to refresh data independently)
export const triggerDataSync = async () => {
  try {
    console.log(`🔄 Manually triggering data sync webhook...`)
    const webhookUrl = '/api/sync-webhook'
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      console.log(`✅ Data sync webhook triggered successfully`)
      return { success: true }
    } else {
      console.warn(`⚠️ Data sync webhook returned ${response.status}`)
      return { success: false, status: response.status }
    }
  } catch (error) {
    console.error(`❌ Failed to trigger data sync webhook:`, error)
    return { success: false, error: error.message }
  }
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