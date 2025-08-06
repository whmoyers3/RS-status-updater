import React, { useState, useEffect } from 'react'
import RazorSyncStatusUpdater from './components/RazorSyncStatusUpdater'
import PasswordProtection from './components/PasswordProtection'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check if user is already authenticated
    const auth = localStorage.getItem('rs-auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleAuthenticated = () => {
    setIsAuthenticated(true)
  }

  if (!isAuthenticated) {
    return <PasswordProtection onAuthenticated={handleAuthenticated} />
  }

  return <RazorSyncStatusUpdater />
}

export default App
