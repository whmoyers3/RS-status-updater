// services/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get work orders with improved filtering (manual joins)
export const getWorkOrders = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select('*')
    .order('rs_start_date', { ascending: true }) // Changed to ASC to match Metabase

  // Apply filters at database level for better performance
  if (filters.field_worker_id) {
    query = query.eq('rs_field_worker_id', filters.field_worker_id)
  }

  // Status filtering - if specific statuses selected, filter by them
  if (filters.status_ids && filters.status_ids.length > 0) {
    query = query.in('rs_status_id', filters.status_ids)
  }

  // Date filtering - use proper SQL comparison
  if (!filters.show_future) {
    query = query.lt('rs_start_date', new Date().toISOString()) // Past dates only
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data: workOrders, error } = await query

  if (error) {
    throw new Error(`Failed to fetch work orders: ${error.message}`)
  }

  // Manually fetch status, fieldworker, and RC homes data for enrichment
  const [statusData, fieldworkerData, rcHomesData] = await Promise.all([
    getStatuses(),
    getFieldworkers(),
    getRCHomesData()
  ])

  // Create lookup maps for better performance
  const statusMap = new Map(statusData.map(status => [status.status_id, status]))
  const fieldworkerMap = new Map(fieldworkerData.map(fw => [fw.id, fw]))
  const rcHomesMap = new Map(rcHomesData.map(home => [home.rs_service_request_id, home]))

  // Combine the data manually
  const enrichedWorkOrders = (workOrders || []).map(workOrder => {
    // Ensure we're comparing the same data types
    const workOrderServiceId = workOrder.rs_service_request_id ? parseInt(workOrder.rs_service_request_id) : null
    const rcHome = workOrderServiceId ? rcHomesMap.get(workOrderServiceId) : null
    
    return {
      ...workOrder,
      rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
      fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null,
      rc_home: rcHome || null
    }
  })

  // Add debugging for RC home matching
  console.log('🔗 Work Order to RC Home matching debug:')
  const workOrdersWithServiceIds = workOrders.filter(wo => wo.rs_service_request_id)
  console.log(`📋 Work orders with service IDs: ${workOrdersWithServiceIds.length}`)
  
  if (workOrdersWithServiceIds.length > 0) {
    const serviceIds = workOrdersWithServiceIds.map(wo => wo.rs_service_request_id)
    console.log(`🔢 Service ID range: ${Math.min(...serviceIds)} - ${Math.max(...serviceIds)}`)
    console.log('🔍 First 5 service IDs:', serviceIds.slice(0, 5))
    
    const matchedCount = enrichedWorkOrders.filter(wo => wo.rc_home).length
    console.log(`✅ Matched RC homes: ${matchedCount}/${workOrders.length}`)
    
    if (matchedCount > 0) {
      const sample = enrichedWorkOrders.find(wo => wo.rc_home)
      console.log('📄 Sample matched work order:', {
        rs_id: sample.rs_id,
        rs_service_request_id: sample.rs_service_request_id,
        rc_home_status: sample.rc_home?.home_status
      })
    }
  }

  return enrichedWorkOrders
}

// Get work order by ID (manual joins)
export const getWorkOrderById = async (id) => {
  const { data: workOrder, error } = await supabase
    .from('rs_work_orders')
    .select('*')
    .or(`rs_id.eq.${id},rs_custom_id.eq.${id}`)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to fetch work order: ${error.message}`)
  }

  // Manually fetch related data
  const [statusData, fieldworkerData, rcHomesData] = await Promise.all([
    getStatuses(),
    getFieldworkers(),
    getRCHomesData()
  ])

  const statusMap = new Map(statusData.map(status => [status.status_id, status]))
  const fieldworkerMap = new Map(fieldworkerData.map(fw => [fw.id, fw]))
  const rcHomesMap = new Map(rcHomesData.map(home => [home.rs_service_request_id, home]))

  // Enrich the work order with related data
  return {
    ...workOrder,
    rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
    fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null,
    rc_home: rcHomesMap.get(workOrder.rs_service_request_id) || null
  }
}

// Get all status options
export const getStatuses = async () => {
  const { data, error } = await supabase
    .from('rs_status_lookup')
    .select('*')
    .order('status_description')

  if (error) {
    throw new Error(`Failed to fetch statuses: ${error.message}`)
  }

  return data
}

// Get incomplete statuses for default selection
export const getIncompleteStatuses = async () => {
  const { data, error } = await supabase
    .from('rs_status_lookup')
    .select('*')
    .eq('is_complete', false)
    .order('status_description')

  if (error) {
    throw new Error(`Failed to fetch incomplete statuses: ${error.message}`)
  }

  return data
}

// Get fieldworkers
export const getFieldworkers = async () => {
  const { data, error } = await supabase
    .from('fieldworkers')
    .select('id, full_name')
    .order('full_name')

  if (error) {
    throw new Error(`Failed to fetch fieldworkers: ${error.message}`)
  }

  return data
}

// Remove the old getIncompleteWorkOrders function as it's no longer needed
// The new filtering system handles this at the database level

// Get RC homes data with matching lookup - using reliable approach
export const getRCHomesData = async () => {
  try {
    console.log('🔍 Starting RC Homes data fetch...')
    
    // First get the matching lookup data with service request IDs
    const { data: matchingData, error: matchingError } = await supabase
      .from('rc_rs_matching_lookup')
      .select('rs_service_request_id, rc_home_id')
      .not('rs_service_request_id', 'is', null)
      .not('rc_home_id', 'is', null)

    if (matchingError) {
      console.error('❌ Failed to fetch RC matching data:', matchingError.message)
      return []
    }

    if (!matchingData || matchingData.length === 0) {
      console.warn('⚠️ No RC matching data found')
      return []
    }

    console.log(`✅ Fetched ${matchingData.length} RC matching records`)
    console.log('📊 Sample matching data:', matchingData.slice(0, 3))

    // Get unique rc_home_ids
    const rcHomeIds = [...new Set(matchingData.map(item => item.rc_home_id).filter(Boolean))]
    
    if (rcHomeIds.length === 0) {
      console.warn('⚠️ No RC home IDs found')
      return []
    }

    console.log(`🏠 Found ${rcHomeIds.length} unique RC home IDs`)

    // Fetch RC homes data
    const { data: rcHomesData, error: homesError } = await supabase
      .from('rc_homes')
      .select('id, home_status')
      .in('id', rcHomeIds)
      .not('home_status', 'is', null)

    if (homesError) {
      console.error('❌ Failed to fetch RC homes data:', homesError.message)
      return []
    }

    if (!rcHomesData || rcHomesData.length === 0) {
      console.warn('⚠️ No RC homes data found')
      return []
    }

    console.log(`🏡 Fetched ${rcHomesData.length} RC homes records`)
    console.log('📊 Sample RC homes data:', rcHomesData.slice(0, 3))

    // Create a map of rc_home_id to home data
    const homeMap = new Map(rcHomesData.map(home => [home.id, home]))

    // Combine matching data with home data
    const result = matchingData.map(match => {
      const homeData = homeMap.get(match.rc_home_id)
      return {
        rs_service_request_id: parseInt(match.rs_service_request_id), // Ensure integer
        rc_home_id: match.rc_home_id,
        home_status: homeData?.home_status || null
      }
    }).filter(item => item.home_status !== null && item.rs_service_request_id !== null)

    console.log(`🎯 Final RC Homes data: ${result.length} records with valid matches`)
    console.log('📊 Sample final data:', result.slice(0, 3))
    
    // Log some statistics
    const serviceRequestIds = result.map(r => r.rs_service_request_id)
    const minId = Math.min(...serviceRequestIds)
    const maxId = Math.max(...serviceRequestIds)
    console.log(`📈 Service Request ID range: ${minId} - ${maxId}`)
    
    return result
    
  } catch (error) {
    console.error('💥 Error fetching RC homes data:', error)
    return []
  }
}

// Count total work orders with better filtering
export const getWorkOrdersCount = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select('rs_id', { count: 'exact', head: true })

  if (filters.field_worker_id) {
    query = query.eq('rs_field_worker_id', filters.field_worker_id)
  }

  // Status filtering at database level
  if (filters.status_ids && filters.status_ids.length > 0) {
    query = query.in('rs_status_id', filters.status_ids)
  }

  // Date filtering
  if (!filters.show_future) {
    query = query.lt('rs_start_date', new Date().toISOString())
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Failed to count work orders: ${error.message}`)
  }

  return count || 0
}