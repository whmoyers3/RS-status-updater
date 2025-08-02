// hooks/useWorkOrders.js
import { useState, useEffect, useCallback } from 'react'
import { getWorkOrders, getWorkOrderById, getWorkOrdersCount } from '../services/supabase'

export const useWorkOrders = (filters = {}, autoFetch = true) => {
  const [workOrders, setWorkOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [ordersData, count] = await Promise.all([
        getWorkOrders(filters),
        getWorkOrdersCount(filters)
      ])
      
      setWorkOrders(ordersData)
      setTotalCount(count)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    if (autoFetch) {
      fetchWorkOrders()
    }
  }, [fetchWorkOrders, autoFetch])

  const refresh = useCallback(() => {
    fetchWorkOrders()
  }, [fetchWorkOrders])

  return {
    workOrders,
    loading,
    error,
    totalCount,
    refresh,
    fetchWorkOrders
  }
}