// Test component to debug environment variables and Supabase connection
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const DebugComponent = () => {
  const [debugInfo, setDebugInfo] = useState({});
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    const runTests = async () => {
      // Check environment variables
      const envInfo = {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabaseKeyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length || 0,
        hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
        hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        mode: import.meta.env.MODE,
        dev: import.meta.env.DEV
      };

      setDebugInfo(envInfo);

      // Test Supabase connection
      if (envInfo.hasUrl && envInfo.hasKey) {
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        const results = {};

        try {
          console.log('Testing fieldworkers...');
          const { data: fieldworkers, error: fwError } = await supabase
            .from('fieldworkers')
            .select('id, full_name')
            .limit(3);
          
          results.fieldworkers = {
            success: !fwError,
            error: fwError?.message,
            count: fieldworkers?.length || 0,
            data: fieldworkers
          };
        } catch (error) {
          results.fieldworkers = {
            success: false,
            error: error.message
          };
        }

        try {
          console.log('Testing statuses...');
          const { data: statuses, error: statusError } = await supabase
            .from('rs_status_lookup')
            .select('status_id, status_description')
            .limit(3);
          
          results.statuses = {
            success: !statusError,
            error: statusError?.message,
            count: statuses?.length || 0,
            data: statuses
          };
        } catch (error) {
          results.statuses = {
            success: false,
            error: error.message
          };
        }

        try {
          console.log('Testing work orders...');
          const { data: workOrders, error: woError } = await supabase
            .from('rs_work_orders')
            .select('rs_id, rs_field_worker_id, rs_status_id')
            .limit(3);
          
          results.workOrders = {
            success: !woError,
            error: woError?.message,
            count: workOrders?.length || 0,
            data: workOrders
          };
        } catch (error) {
          results.workOrders = {
            success: false,
            error: error.message
          };
        }

        setTestResults(results);
      }
    };

    runTests();
  }, []);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Supabase Debug Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Environment Variables */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Environment Variables</h2>
            <div className="space-y-2 text-sm">
              <div>URL: {debugInfo.hasUrl ? '✅ Set' : '❌ Missing'}</div>
              <div>Key: {debugInfo.hasKey ? `✅ Set (${debugInfo.supabaseKeyLength} chars)` : '❌ Missing'}</div>
              <div>Mode: {debugInfo.mode}</div>
              <div>Dev: {debugInfo.dev ? 'Yes' : 'No'}</div>
              {debugInfo.supabaseUrl && (
                <div className="mt-2 text-xs text-gray-600">
                  URL: {debugInfo.supabaseUrl}
                </div>
              )}
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Connection Tests</h2>
            <div className="space-y-3">
              {Object.entries(testResults).map(([key, result]) => (
                <div key={key} className="border-l-4 border-gray-200 pl-3">
                  <div className="font-medium capitalize">{key}</div>
                  <div className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    {result.success ? `✅ Success (${result.count} records)` : `❌ Error: ${result.error}`}
                  </div>
                  {result.data && (
                    <div className="text-xs text-gray-500 mt-1">
                      <pre>{JSON.stringify(result.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Raw Data */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Raw Debug Data</h2>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify({ debugInfo, testResults }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DebugComponent;
