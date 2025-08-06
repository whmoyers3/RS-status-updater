import React, { useState, useEffect } from 'react'
import RazorSyncStatusUpdater from './components/RazorSyncStatusUpdater'
import ServiceTicketDashboard from './components/ServiceTicketDashboard'
import PasswordProtection from './components/PasswordProtection'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Service Tickets Dashboard
            </button>
            <button
              onClick={() => setActiveTab('updater')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'updater'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              RazorSync Status Updater
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && <ServiceTicketDashboard />}
      {activeTab === 'updater' && <RazorSyncStatusUpdater />}
    </div>
  )
}

export default App
