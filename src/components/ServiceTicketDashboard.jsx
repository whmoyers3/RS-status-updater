import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const ServiceTicketDashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      
      // Use a single query with joins to avoid timing issues
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('rc_homes')
        .select(`
          id,
          ticket_number,
          customer_name,
          description,
          status,
          priority,
          assigned_to,
          created_date,
          _rs_matching_lookup!_rs_matching_lookup_rc_id_fkey (
            rs_service_request_id,
            rs_work_orders!_rs_matching_lookup_rs_service_request_id_fkey (
              rs_id
            )
          )
        `)
        .order('created_date', { ascending: false })
        .limit(50);

      if (ticketsError) {
        console.error('Tickets query error:', ticketsError);
        
        // Fallback to the original method if joins fail
        const { data: basicTicketsData, error: basicError } = await supabase
          .from('rc_homes')
          .select(`
            id,
            ticket_number,
            customer_name,
            description,
            status,
            priority,
            assigned_to,
            created_date
          `)
          .order('created_date', { ascending: false })
          .limit(50);

        if (basicError) throw basicError;

        // Process each ticket individually with proper data type handling
        const ticketsWithRazorSync = await Promise.all(
          (basicTicketsData || []).map(async (ticket) => {
            try {
              // Convert ticket.id to string for the lookup since rc_id is text
              const { data: lookupData } = await supabase
                .from('_rs_matching_lookup')
                .select('rs_service_request_id')
                .eq('rc_id', String(ticket.id))
                .maybeSingle();

              if (lookupData?.rs_service_request_id) {
                // rs_service_request_id should match as both are integers
                const { data: workOrderData } = await supabase
                  .from('rs_work_orders')
                  .select('rs_id')
                  .eq('rs_service_request_id', lookupData.rs_service_request_id)
                  .maybeSingle();

                return {
                  ...ticket,
                  razorsync_id: workOrderData?.rs_id || null
                };
              }

              return {
                ...ticket,
                razorsync_id: null
              };
            } catch (error) {
              console.error(`Error processing ticket ${ticket.id}:`, error);
              return {
                ...ticket,
                razorsync_id: null
              };
            }
          })
        );

        setTickets(ticketsWithRazorSync);
        return;
      }

      // Process the joined data
      const processedTickets = ticketsData.map(ticket => ({
        ...ticket,
        razorsync_id: ticket._rs_matching_lookup?.[0]?.rs_work_orders?.[0]?.rs_id || null
      }));

      setTickets(processedTickets);
      
    } catch (error) {
      setError(error.message);
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading service tickets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={fetchTickets}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Service Ticket Dashboard</h1>
          <p className="mt-2 text-gray-600">View and manage service tickets with RazorSync integration</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">Total Tickets</h3>
            <p className="text-3xl font-bold text-blue-600">{tickets.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">RazorSync Linked</h3>
            <p className="text-3xl font-bold text-green-600">
              {tickets.filter(t => t.razorsync_id).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">Unlinked</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {tickets.filter(t => !t.razorsync_id).length}
            </p>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recent Tickets</h3>
              <button
                onClick={fetchTickets}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                🔄 Refresh
              </button>
            </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-white shadow-sm rounded-lg table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
                  <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="w-48 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
                  <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RazorSync</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-sm text-gray-900">{ticket.ticket_number}</td>
                    <td className="px-2 py-2 text-sm text-gray-900 truncate" title={ticket.customer_name}>
                      {ticket.customer_name}
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-900">
                      <div className="break-words max-h-20 overflow-y-auto">
                        {ticket.description}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm">
                      <div className="break-words">
                        {ticket.razorsync_id ? (
                          <a 
                            href={`https://app.razorsync.com/work_orders/${ticket.razorsync_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                            title={`Open RazorSync Work Order ${ticket.razorsync_id}`}
                          >
                            {ticket.status}
                          </a>
                        ) : (
                          <span className="text-gray-500">{ticket.status || 'N/A'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-900">{ticket.priority}</td>
                    <td className="px-2 py-2 text-sm text-gray-900 truncate" title={ticket.assigned_to}>
                      {ticket.assigned_to}
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-900">
                      {ticket.created_date ? new Date(ticket.created_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-2 py-2 text-sm text-center">
                      {ticket.razorsync_id ? (
                        <span className="text-green-600 font-semibold">✓</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceTicketDashboard;
