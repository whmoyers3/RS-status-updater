import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export const getStatuses = async () => {
  const { data, error } = await supabase
    .from('rs_status_lookup')
    .select('*')
    .order('status_description')

  if (error) throw new Error(`Failed to fetch statuses: ${error.message}`)
  return data
}

export const getFieldWorkers = async () => {
  const { data, error } = await supabase
    .from('fieldworkers')
    .select('*')
    .order('full_name')

  if (error) throw new Error(`Failed to fetch field workers: ${error.message}`)
  return data
}

export const getWorkOrders = async (filters = {}) => {
  let query = supabase
    .from('rs_work_orders')
    .select(`
      *,
      rs_status_lookup (*),
      fieldworkers:rs_field_worker_id (*),
      rc_home:rc_home_id (id, home_status)
    `)
    .order('rs_start_date', { ascending: true })

  if (filters.field_worker_id) {
    query = query.eq('rs_field_worker_id', filters.field_worker_id)
  }

  if (filters.status_ids?.length > 0) {
    query = query.in('rs_status_id', filters.status_ids)
  }

  if (!filters.show_future) {
    query = query.lt('rs_start_date', new Date().toISOString())
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch work orders: ${error.message}`)
  return data
}

export const getWorkOrderById = async (id) => {
  const { data, error } = await supabase
    .from('rs_work_orders')
    .select(`
      *,
      rs_status_lookup (*),
      fieldworkers:rs_field_worker_id (*),
      rc_home:rc_home_id (id, home_status)
    `)
    .or(`rs_id.eq.${id},rs_custom_id.eq.${id}`)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch work order: ${error.message}`)
  }

  return data
}
