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

  // Manually fetch status and fieldworker data for enrichment
  const [statusData, fieldworkerData] = await Promise.all([
    getStatuses(),
    getFieldworkers()
  ])

  // Create lookup maps for better performance
  const statusMap = new Map(statusData.map(status => [status.status_id, status]))
  const fieldworkerMap = new Map(fieldworkerData.map(fw => [fw.id, fw]))

  // Combine the data manually
  const enrichedWorkOrders = (workOrders || []).map(workOrder => ({
    ...workOrder,
    rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
    fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null
  }))

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