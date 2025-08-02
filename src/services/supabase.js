// services/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get work orders with status and fieldworker info
export const getWorkOrders = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select(`
      rs_id,
      rs_custom_id,
      description,
      rs_start_date,
      rs_field_worker_id,
      rs_status_id,
      rs_create_date,
      rs_last_change_date,
      rs_service_request_id,
      rs_customer_id,
      notes,
      rs_status_lookup(
        status_id,
        status_description,
        status_category,
        is_complete
      ),
      fieldworkers(
        id,
        full_name
      )
    `)
    .order('rs_start_date', { ascending: false })

  // Apply filters
  if (filters.incomplete_only) {
    query = query.eq('rs_status_lookup.is_complete', false)
  }  
  if (filters.field_worker_id) {
    query = query.eq('rs_field_worker_id', filters.field_worker_id)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch work orders: ${error.message}`)
  }

  return data
}

// Get work order by ID (RazorSync ID or Custom ID)
export const getWorkOrderById = async (id) => {
  const { data, error } = await supabase
    .from('rs_work_orders')
    .select(`
      rs_id,
      rs_custom_id,
      description,
      rs_start_date,
      rs_field_worker_id,
      rs_status_id,
      rs_create_date,
      rs_last_change_date,
      rs_service_request_id,
      rs_customer_id,
      notes,
      rs_status_lookup(
        status_id,
        status_description,
        status_category,
        is_complete
      ),
      fieldworkers(
        id,
        full_name
      )
    `)
    .or(`rs_id.eq.${id},rs_custom_id.eq.${id}`)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to fetch work order: ${error.message}`)
  }

  return data
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

// Count total work orders
export const getWorkOrdersCount = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select('rs_id', { count: 'exact', head: true })

  if (filters.incomplete_only) {
    query = query.eq('rs_status_lookup.is_complete', false)
  }

  if (filters.field_worker_id) {
    query = query.eq('rs_field_worker_id', filters.field_worker_id)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Failed to count work orders: ${error.message}`)
  }

  return count
}