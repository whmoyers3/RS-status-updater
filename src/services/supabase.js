// services/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get work orders with manual joins (no foreign key constraints)
export const getWorkOrders = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select('*')
    .order('rs_start_date', { ascending: true })

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
    query = query.lt('rs_start_date', new Date().toISOString())
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

  // Get related data for enrichment
  const [statusData, fieldworkerData, rcHomesData] = await Promise.all([
    getStatuses(),
    getFieldworkers(),
    getRCHomesForWorkOrders(workOrders)
  ])

  // Create lookup maps
  const statusMap = new Map(statusData.map(status => [status.status_id, status]))
  const fieldworkerMap = new Map(fieldworkerData.map(fw => [fw.id, fw]))
  const rcHomesMap = new Map(rcHomesData.map(home => [home.id, home]))

  // Enrich work orders with related data
  const enrichedWorkOrders = (workOrders || []).map(workOrder => ({
    ...workOrder,
    rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
    fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null,
    rc_home: workOrder.rc_home_id ? rcHomesMap.get(workOrder.rc_home_id) : null
  }))

  console.log('📊 Work Orders Results:')
  console.log(`Total work orders: ${workOrders?.length || 0}`)
  const withRCHomes = enrichedWorkOrders.filter(wo => wo.rc_home)
  console.log(`With RC homes: ${withRCHomes.length}`)

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

  // Get related data for enrichment
  const [statusData, fieldworkerData, rcHomesData] = await Promise.all([
    getStatuses(),
    getFieldworkers(),
    getRCHomesForWorkOrders([workOrder])
  ])

  const statusMap = new Map(statusData.map(status => [status.status_id, status]))
  const fieldworkerMap = new Map(fieldworkerData.map(fw => [fw.id, fw]))
  const rcHomesMap = new Map(rcHomesData.map(home => [home.id, home]))

  // Enrich the work order with related data
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

// Get RC homes for specific work orders
export const getRCHomesForWorkOrders = async (workOrders) => {
  if (!workOrders || workOrders.length === 0) {
    return []
  }

  // Get unique rc_home_ids from the work orders
  const rcHomeIds = [...new Set(
    workOrders
      .map(wo => wo.rc_home_id)
      .filter(id => id !== null && id !== undefined)
  )]

  if (rcHomeIds.length === 0) {
    console.log('No RC home IDs found in work orders')
    return []
  }

  console.log(`Fetching RC homes for ${rcHomeIds.length} unique IDs`)

  const { data: rcHomes, error } = await supabase
    .from('rc_homes')
    .select('id, home_status')
    .in('id', rcHomeIds)
    .not('home_status', 'is', null)

  if (error) {
    console.error('Failed to fetch RC homes:', error.message)
    return []
  }

  console.log(`Successfully fetched ${rcHomes?.length || 0} RC homes`)
  return rcHomes || []
}

// Remove the old getRCHomesData function as it's no longer needed
// RC homes are now fetched directly via JOIN in the work orders query

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
