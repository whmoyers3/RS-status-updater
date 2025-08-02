import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Trash2, AlertCircle, CheckCircle, Clock, Edit3, Users, ChevronUp, ChevronDown } from 'lucide-react';
import { useWorkOrders } from '../hooks/useWorkOrders';
import { getWorkOrderById, getStatuses, getFieldworkers, getIncompleteStatuses } from '../services/supabase';
import { updateWorkOrderStatus, deleteWorkOrder } from '../services/razorsync';
import MultiSelectDropdown from './MultiSelectDropdown';

const RazorSyncStatusUpdater = () => {
  const [activeTab, setActiveTab] = useState('batch');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [fieldworkers, setFieldworkers] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedFieldWorker, setSelectedFieldWorker] = useState('');
  const [selectedStatusIds, setSelectedStatusIds] = useState([]); // New multi-select state
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [showFutureEvents, setShowFutureEvents] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'rs_start_date', direction: 'asc' });

  const [filters, setFilters] = useState({
    field_worker_id: null,
    status_ids: [], // Will be set to incomplete statuses by default
    limit: itemsPerPage,
    offset: 0,
    show_future: false
  });

  const { workOrders, loading, error, totalCount, refresh } = useWorkOrders(filters, true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [statusData, fieldworkerData, incompleteStatusData] = await Promise.all([
          getStatuses(),
          getFieldworkers(),
          getIncompleteStatuses()
        ]);
        
        setStatuses(statusData);
        setFieldworkers(fieldworkerData);
        
        // Set default selected statuses to all incomplete statuses
        const defaultStatusIds = incompleteStatusData.map(status => status.status_id);
        setSelectedStatusIds(defaultStatusIds);
        
        // Update filters with default incomplete statuses
        setFilters(prev => ({
          ...prev,
          status_ids: defaultStatusIds
        }));
        
      } catch (err) {
        showNotification('Failed to load initial data', 'error');
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      field_worker_id: selectedFieldWorker || null,
      status_ids: selectedStatusIds,
      offset: (currentPage - 1) * itemsPerPage,
      show_future: showFutureEvents
    }));
  }, [selectedFieldWorker, selectedStatusIds, currentPage, itemsPerPage, showFutureEvents]);

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
      const updatePromises = selectedOrders.map(orderId => 
        updateWorkOrderStatus(orderId, selectedStatus)
      );
      
      await Promise.all(updatePromises);
      
      setSelectedOrders([]);
      setSelectedStatus('');
      showNotification(`Successfully updated ${selectedOrders.length} work order(s). Refreshing data in 5 seconds...`);
      
      // Auto-refresh after 5 seconds to show updated data
      setTimeout(() => {
        refresh();
      }, 5000);
      
    } catch (error) {
      showNotification(`Failed to update work orders: ${error.message}`, 'error');
      console.error('Batch update error:', error);
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
      const found = await getWorkOrderById(searchId.trim());
      
      if (found) {
        setSearchResult(found);
        showNotification('Work order found');
      } else {
        setSearchResult(null);
        showNotification('Work order not found', 'error');
      }
    } catch (error) {
      showNotification(`Search failed: ${error.message}`, 'error');
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSingle = async (newStatusId) => {
    if (!searchResult) return;

    setIsLoading(true);
    try {
      await updateWorkOrderStatus(searchResult.rs_id, newStatusId);
      
      showNotification('Work order status updated successfully. Refreshing data in 5 seconds...');
      
      // Auto-refresh the search result after 5 seconds
      setTimeout(async () => {
        try {
          const updated = await getWorkOrderById(searchResult.rs_id);
          setSearchResult(updated);
          showNotification('Data refreshed with latest information', 'success');
        } catch (error) {
          console.error('Failed to refresh search result:', error);
        }
      }, 5000);
      
    } catch (error) {
      showNotification(`Failed to update work order status: ${error.message}`, 'error');
      console.error('Single update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (workOrderId) => {
    if (!confirm('Are you sure you want to delete this work order? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteWorkOrder(workOrderId);
      
      if (searchResult && searchResult.rs_id === workOrderId) {
        setSearchResult(null);
        setSearchId('');
      }
      
      await refresh();
      showNotification('Work order deleted successfully');
    } catch (error) {
      showNotification(`Failed to delete work order: ${error.message}`, 'error');
      console.error('Delete error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedWorkOrders = () => {
    if (!workOrders) return [];
    
    const sortedOrders = [...workOrders].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'status_description') {
        aValue = a.rs_status_lookup?.status_description || '';
        bValue = b.rs_status_lookup?.status_description || '';
      } else if (sortConfig.key === 'fieldworker_name') {
        aValue = a.fieldworkers?.full_name || '';
        bValue = b.fieldworkers?.full_name || '';
      }
      
      if (sortConfig.key === 'rs_start_date') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sortedOrders;
  };

  const SortHeader = ({ column, children }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortConfig.key === column && (
          sortConfig.direction === 'asc' ? 
            <ChevronUp className="w-4 h-4" /> : 
            <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const getStatusBadgeColor = (isComplete) => {
    return isComplete 
      ? 'bg-green-100 text-green-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const filterWorkOrdersByDate = (orders) => {
    if (!showFutureEvents) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return orders.filter(wo => {
        const startDate = new Date(wo.rs_start_date);
        return startDate <= today;
      });
    }
    return orders;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">Failed to connect to database: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const sortedAndFilteredOrders = filterWorkOrdersByDate(getSortedWorkOrders());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Edit3 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">RazorSync Status Updater</h1>
            </div>
            <button 
              onClick={refresh}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          <div className="flex items-center">
            {notification.type === 'success' ? 
              <CheckCircle className="w-5 h-5 mr-2" /> : 
              <AlertCircle className="w-5 h-5 mr-2" />
            }
            {notification.message}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('batch')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'batch'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5 inline mr-2" />
                Batch Status Updates
              </button>
              <button
                onClick={() => setActiveTab('individual')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'individual'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Search className="w-5 h-5 inline mr-2" />
                Individual Work Order Lookup
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'batch' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Work Orders</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field Worker
                  </label>
                  <select
                    value={selectedFieldWorker}
                    onChange={(e) => setSelectedFieldWorker(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Workers</option>
                    {fieldworkers.map(fw => (
                      <option key={fw.id} value={fw.id}>{fw.full_name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Types
                  </label>
                  <MultiSelectDropdown
                    options={statuses.map(status => ({
                      value: status.status_id,
                      label: `${status.status_description}${!status.is_complete ? ' (Incomplete)' : ''}`
                    }))}
                    selectedValues={selectedStatusIds}
                    onChange={setSelectedStatusIds}
                    placeholder="Select statuses..."
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showFutureEvents}
                      onChange={(e) => setShowFutureEvents(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Show Future Events</span>
                  </label>
                  <button
                    onClick={refresh}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 inline mr-2" />
                    Refresh Data
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select New Status</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Status...</option>
                  {statuses.map(status => (
                    <option key={status.status_id} value={status.status_id}>
                      {status.status_description}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBatchUpdate}
                  disabled={!selectedStatus || selectedOrders.length === 0 || isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  {isLoading ? 'Updating...' : `Update Selected (${selectedOrders.length})`}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Showing {sortedAndFilteredOrders.length} of {totalCount} results
                </h3>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading work orders...</span>
                </div>
              ) : sortedAndFilteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No work orders found matching your criteria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={selectedOrders.length === sortedAndFilteredOrders.length && sortedAndFilteredOrders.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <SortHeader column="rs_id">RazorSync ID</SortHeader>
                        <SortHeader column="rs_custom_id">Custom ID</SortHeader>
                        <SortHeader column="description">Description</SortHeader>
                        <SortHeader column="rs_start_date">Start Date</SortHeader>
                        <SortHeader column="fieldworker_name">Field Worker</SortHeader>
                        <SortHeader column="status_description">Status</SortHeader>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedAndFilteredOrders.map((workOrder) => (
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
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {workOrder.fieldworkers?.full_name || 'Unassigned'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              getStatusBadgeColor(workOrder.rs_status_lookup?.is_complete)
                            }`}>
                              {workOrder.rs_status_lookup?.status_description || 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'individual' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Search Work Order</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Enter RazorSync ID or Custom ID"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {searchResult && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Work Order Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">RazorSync ID</label>
                    <p className="mt-1 text-sm text-gray-900">{searchResult.rs_id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Custom ID</label>
                    <p className="mt-1 text-sm text-gray-900">{searchResult.rs_custom_id}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-sm text-gray-900">{searchResult.description}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(searchResult.rs_start_date)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Field Worker</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {searchResult.fieldworkers?.full_name || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      getStatusBadgeColor(searchResult.rs_status_lookup?.is_complete)
                    }`}>
                      {searchResult.rs_status_lookup?.status_description || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Update Status</h4>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <select
                      onChange={(e) => e.target.value && handleUpdateSingle(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value=""
                    >
                      <option value="">Select new status...</option>
                      {statuses.map(status => (
                        <option key={status.status_id} value={status.status_id}>
                          {status.status_description}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDelete(searchResult.rs_id)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 transition-colors flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
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