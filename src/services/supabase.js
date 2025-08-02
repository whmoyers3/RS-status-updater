// services/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get work orders with manual status and fieldworker joins
export const getWorkOrders = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select('*')
    .order('rs_start_date', { ascending: false })

  // Apply filters
  if (filters.field_worker_id) {
    query = query.eq('rs_field_worker_id', filters.field_worker_id)
  }

  // Filter future events if not requested
  if (!filters.show_future) {
    const today = new Date().toISOString().split('T')[0]
    query = query.lte('rs_start_date', today + 'T23:59:59.999Z')
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

  // Manually fetch status and fieldworker data
  const [statusData, fieldworkerData] = await Promise.all([
    getStatuses(),
    getFieldworkers()
  ])

  // Create lookup maps for better performance
  const statusMap = new Map(statusData.map(status => [status.status_id, status]))
  const fieldworkerMap = new Map(fieldworkerData.map(fw => [fw.id, fw]))

  // Combine the data manually
  const enrichedWorkOrders = workOrders.map(workOrder => ({
    ...workOrder,
    rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
    fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null
  }))

  // Apply incomplete filter after enrichment if needed
  if (filters.incomplete_only) {
    return enrichedWorkOrders.filter(wo => 
      wo.rs_status_lookup && !wo.rs_status_lookup.is_complete
    )
  }

  return enrichedWorkOrders
}

// Get work order by ID (RazorSync ID or Custom ID)
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
  const [statusData, fieldworkerData] = await Promise.all([
    getStatuses(),
    getFieldworkers()
  ])

  const statusMap = new Map(statusData.map(status => [status.status_id, status]))
  const fieldworkerMap = new Map(fieldworkerData.map(fw => [fw.id, fw]))

  // Enrich the work order with related data
  return {
    ...workOrder,
    rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
    fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null
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

// Get incomplete work orders for the metabase report
export const getIncompleteWorkOrders = async (filters = {}) => {
  return getWorkOrders({
    ...filters,
    incomplete_only: true
  })
}

// Count total work orders with manual filtering
export const getWorkOrdersCount = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select('rs_id', { count: 'exact', head: true })

  if (filters.field_worker_id) {
    query = query.eq('rs_field_worker_id', filters.field_worker_id)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Failed to count work orders: ${error.message}`)
  }

  // If incomplete_only filter is applied, we need to fetch and filter manually
  if (filters.incomplete_only) {
    // For count with incomplete filter, we need to fetch the data and filter
    const workOrders = await getWorkOrders(filters)
    return workOrders.length
  }

  return count
}