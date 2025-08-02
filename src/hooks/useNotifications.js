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