import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Trash2, AlertCircle, CheckCircle, Clock, Edit3, Users } from 'lucide-react';

// Mock data based on your rs_work_orders table
const mockWorkOrders = [
  {
    rs_id: "56335",
    rs_custom_id: "21393-23",
    description: "Contract services 4 weeks",
    rs_start_date: "2026-12-25T14:00:00Z",
    rs_field_worker_id: 7,
    rs_status_id: 1,
    status_description: "Incomplete - Scheduled",
    is_complete: false,
    fieldworker_name: "Sarah Wilson"
  },
  {
    rs_id: "56334",
    rs_custom_id: "21393-22", 
    description: "Contract services 4 weeks",
    rs_start_date: "2026-11-27T14:00:00Z",
    rs_field_worker_id: 7,
    rs_status_id: 1,
    status_description: "Incomplete - Scheduled",
    is_complete: false,
    fieldworker_name: "Sarah Wilson"
  },
  {
    rs_id: "56345",
    rs_custom_id: "21396-10",
    description: "Contract Services 5 weeks", 
    rs_start_date: "2026-10-30T13:00:00Z",
    rs_field_worker_id: 7,
    rs_status_id: 1,
    status_description: "Incomplete - Scheduled",
    is_complete: false,
    fieldworker_name: "Sarah Wilson"
  }
];
const mockStatuses = [
  { status_id: 1, status_description: "Incomplete - Scheduled", is_complete: false },
  { status_id: 2, status_description: "Complete - To Billing (Michael)", is_complete: true },
  { status_id: 3, status_description: "Data Entry - DET to Kevin", is_complete: false },
  { status_id: 5, status_description: "Invoiced", is_complete: true },
  { status_id: 6, status_description: "Unassigned", is_complete: false },
  { status_id: 10, status_description: "Invoiced - Paid", is_complete: true },
  { status_id: 26, status_description: "Incomplete - Enroute", is_complete: false },
  { status_id: 27, status_description: "Incomplete - On Site", is_complete: false },
  { status_id: 30, status_description: "Complete - Rescheduled", is_complete: true },
  { status_id: 44, status_description: "Complete - Final Completed", is_complete: true }
];

const RazorSyncStatusUpdater = () => {
  const [activeTab, setActiveTab] = useState('batch');
  const [workOrders, setWorkOrders] = useState(mockWorkOrders);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [statuses, setStatuses] = useState(mockStatuses);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Simulate API calls
  const simulateApiCall = (delay = 1000) => {
    return new Promise(resolve => setTimeout(resolve, delay));
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(workOrders.map(wo => wo.rs_id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId, checked) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleBatchUpdate = async () => {
    if (!selectedStatus || selectedOrders.length === 0) {
      showNotification('Please select a status and at least one work order', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call to RazorSync
      await simulateApiCall(2000);
      
      // Update local state (in real app, refetch from Supabase)
      const statusObj = statuses.find(s => s.status_id === parseInt(selectedStatus));
      setWorkOrders(workOrders.map(wo => 
        selectedOrders.includes(wo.rs_id) 
          ? { ...wo, rs_status_id: parseInt(selectedStatus), status_description: statusObj.status_description, is_complete: statusObj.is_complete }
          : wo
      ));
      
      setSelectedOrders([]);
      setSelectedStatus('');
      showNotification(`Successfully updated ${selectedOrders.length} work order(s)`);
    } catch (error) {
      showNotification('Failed to update work orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleSearch = async () => {
    if (!searchId.trim()) {
      showNotification('Please enter a RazorSync ID or Custom ID', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await simulateApiCall(1000);
      
      // Simulate finding work order
      const found = mockWorkOrders.find(wo => 
        wo.rs_id === searchId || wo.rs_custom_id === searchId
      );
      
      if (found) {
        setSearchResult(found);
        showNotification('Work order found');
      } else {
        setSearchResult(null);
        showNotification('Work order not found', 'error');
      }
    } catch (error) {
      showNotification('Search failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSingle = async (newStatusId) => {
    if (!searchResult) return;

    setIsLoading(true);
    try {
      await simulateApiCall(1500);
      
      const statusObj = statuses.find(s => s.status_id === newStatusId);
      setSearchResult({
        ...searchResult,
        rs_status_id: newStatusId,
        status_description: statusObj.status_description,
        is_complete: statusObj.is_complete
      });
      
      showNotification('Work order updated successfully');
    } catch (error) {
      showNotification('Failed to update work order', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleDeleteSingle = async () => {
    if (!searchResult) return;
    
    if (!window.confirm(`Are you sure you want to delete work order ${searchResult.rs_id}? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      await simulateApiCall(1500);
      setSearchResult(null);
      setSearchId('');
      showNotification('Work order deleted successfully');
    } catch (error) {
      showNotification('Failed to delete work order', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeColor = (isComplete) => {
    return isComplete 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };
  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">RazorSync Status Updater</h1>
        <p className="text-gray-600">Update work order statuses and manage your RazorSync data</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-6 p-4 rounded-lg border ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
            {notification.message}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('batch')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'batch'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-5 h-5 inline mr-2" />
              Batch Updates
            </button>            <button
              onClick={() => setActiveTab('individual')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'individual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Search className="w-5 h-5 inline mr-2" />
              Individual Lookup
            </button>
          </nav>
        </div>

        {/* Batch Update Tab */}
        {activeTab === 'batch' && (
          <div className="p-6">
            {/* Filters and Actions */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                  <select className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm">
                    <option>Incomplete Only</option>
                    <option>All Statuses</option>
                    <option>Complete Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Worker</label>
                  <select className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm">
                    <option>All Workers</option>
                    <option>Sarah Wilson</option>
                    <option>John Smith</option>
                    <option>Mike Johnson</option>
                  </select>
                </div>
              </div>              
              <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </button>
            </div>

            {/* Batch Actions */}
            <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === workOrders.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Select All</span>
                </label>
                
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm"
                  >
                    <option value="">Select New Status</option>
                    {statuses.map(status => (
                      <option key={status.status_id} value={status.status_id}>
                        {status.status_description}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={handleBatchUpdate}
                    disabled={isLoading || selectedOrders.length === 0 || !selectedStatus}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Edit3 className="w-4 h-4 mr-2" />
                    )}
                    Update {selectedOrders.length} Selected
                  </button>
                </div>
              </div>
            </div>
            {/* Work Orders Table */}
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RazorSync ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custom ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Worker</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workOrders.map((workOrder) => (
                    <tr key={workOrder.rs_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(workOrder.rs_id)}
                          onChange={(e) => handleSelectOrder(workOrder.rs_id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {workOrder.rs_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {workOrder.rs_custom_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {workOrder.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(workOrder.rs_start_date)}
                      </td>                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {workOrder.fieldworker_name || `Worker ${workOrder.rs_field_worker_id}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(workOrder.is_complete)}`}>
                          {workOrder.status_description}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing 1-{workOrders.length} of {workOrders.length} results
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-500 hover:bg-gray-50">
                  Previous
                </button>
                <button className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-500 hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Individual Lookup Tab */}
        {activeTab === 'individual' && (
          <div className="p-6">
            {/* Search Section */}
            <div className="mb-6">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search by RazorSync ID or Custom ID
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      placeholder="Enter ID (e.g., 56335 or 21393-23)"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />                    <button
                      onClick={handleSearch}
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Result */}
            {searchResult && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Work Order Details</h3>
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">RazorSync ID</label>
                    <p className="mt-1 text-sm text-gray-900">{searchResult.rs_id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Custom ID</label>
                    <p className="mt-1 text-sm text-gray-900">{searchResult.rs_custom_id}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-sm text-gray-900">{searchResult.description}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(searchResult.rs_start_date)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Field Worker</label>
                    <p className="mt-1 text-sm text-gray-900">{searchResult.fieldworker_name || `Worker ${searchResult.rs_field_worker_id}`}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Current Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(searchResult.is_complete)}`}>
                        {searchResult.status_description}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center space-x-4 pt-6 border-t border-gray-200">
                  <div className="flex items-center space-x-2 flex-1">
                    <label className="text-sm font-medium text-gray-700">Update Status:</label>
                    <select
                      onChange={(e) => e.target.value && handleUpdateSingle(parseInt(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm"
                      defaultValue=""
                    >
                      <option value="">Select New Status</option>
                      {statuses.map(status => (
                        <option key={status.status_id} value={status.status_id}>
                          {status.status_description}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={handleDeleteSingle}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 transition-colors flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            )}

            {searchId && !searchResult && !isLoading && (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Enter a work order ID and click search to view details</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RazorSyncStatusUpdater;