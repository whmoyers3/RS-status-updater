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
// hooks/useNotifications.js
import { useState, useCallback } from 'react'

export const useNotifications = () => {
  const [notification, setNotification] = useState(null)

  const showNotification = useCallback((message, type = 'success', duration = 3000) => {
    setNotification({ message, type })
    
    if (duration > 0) {
      setTimeout(() => setNotification(null), duration)
    }
  }, [])

  const clearNotification = useCallback(() => {
    setNotification(null)
  }, [])

  const showSuccess = useCallback((message, duration = 3000) => {
    showNotification(message, 'success', duration)
  }, [showNotification])

  const showError = useCallback((message, duration = 5000) => {
    showNotification(message, 'error', duration)
  }, [showNotification])

  return {
    notification,
    showNotification,
    clearNotification,
    showSuccess,
    showError
  }
}