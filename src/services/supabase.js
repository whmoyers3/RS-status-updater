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
  const rcHomesMap = new Map(rcHomesData.map(home => [home.rc_home_id, home]))

  console.log('🗺️ RC Homes Map Debug:')
  console.log(`RC Homes Map size: ${rcHomesMap.size}`)
  console.log('First 5 RC map entries:', Array.from(rcHomesMap.entries()).slice(0, 5))

  // Combine the data manually using direct rc_home_id relationship
  const enrichedWorkOrders = (workOrders || []).map(workOrder => {
    // Use direct rc_home_id from work order
    const rcHome = workOrder.rc_home_id ? rcHomesMap.get(workOrder.rc_home_id) : null
    
    return {
      ...workOrder,
      rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
      fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null,
      rc_home: rcHome || null
    }
  })

  // Add debugging for RC home matching
  console.log('🔗 Work Order to RC Home matching debug:')
  const workOrdersWithRCIds = workOrders.filter(wo => wo.rc_home_id)
  console.log(`📋 Work orders with RC home IDs: ${workOrdersWithRCIds.length}`)
  
  if (workOrdersWithRCIds.length > 0) {
    const rcHomeIds = workOrdersWithRCIds.map(wo => wo.rc_home_id)
    console.log('🏠 First 10 RC home IDs from work orders:', rcHomeIds.slice(0, 10))
    
    // Test specific work orders to see if they match
    console.log('🧪 Testing RC home matches:')
    rcHomeIds.slice(0, 5).forEach(rcHomeId => {
      const match = rcHomesMap.get(rcHomeId)
      console.log(`RC Home ID ${rcHomeId}: ${match ? `Found - ${match.home_status}` : 'NOT FOUND'}`)
    })
    
    const matchedCount = enrichedWorkOrders.filter(wo => wo.rc_home).length
    console.log(`✅ Matched RC homes: ${matchedCount}/${workOrders.length}`)
    
    if (matchedCount > 0) {
      const sample = enrichedWorkOrders.find(wo => wo.rc_home)
      console.log('📄 Sample matched work order:', {
        rs_id: sample.rs_id,
        rc_home_id: sample.rc_home_id,
        rc_home_status: sample.rc_home?.home_status
      })
    } else {
      console.log('⚠️ NO MATCHES FOUND - check rc_home_id values')
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
  const rcHomesMap = new Map(rcHomesData.map(home => [home.rc_home_id, home]))

  // Enrich the work order with related data using direct rc_home_id
  return {
    ...workOrder,
    rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
    fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null,
    rc_home: workOrder.rc_home_id ? rcHomesMap.get(workOrder.rc_home_id) : null
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

// Get RC homes data - now using direct rc_home_id from work orders
export const getRCHomesData = async () => {
  try {
    console.log('🔍 Starting RC Homes data fetch using direct rc_home_id...')
    
    // Get all unique rc_home_ids from work orders that have them
    const { data: workOrdersWithRCIds, error: workOrdersError } = await supabase
      .from('rs_work_orders')
      .select('rc_home_id')
      .not('rc_home_id', 'is', null)

    if (workOrdersError) {
      console.error('❌ Failed to fetch work orders with RC home IDs:', workOrdersError.message)
      return []
    }

    if (!workOrdersWithRCIds || workOrdersWithRCIds.length === 0) {
      console.warn('⚠️ No work orders with RC home IDs found')
      return []
    }

    // Get unique rc_home_ids
    const rcHomeIds = [...new Set(workOrdersWithRCIds.map(item => item.rc_home_id).filter(Boolean))]
    
    if (rcHomeIds.length === 0) {
      console.warn('⚠️ No RC home IDs found')
      return []
    }

    console.log(`🏠 Found ${rcHomeIds.length} unique RC home IDs from work orders`)

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

    // Return data keyed by rc_home_id for easy lookup
    const result = rcHomesData.map(home => ({
      rc_home_id: home.id,
      home_status: home.home_status
    }))

    console.log(`🎯 Final RC Homes data: ${result.length} records`)
    console.log('📊 Sample final data:', result.slice(0, 3))
    
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