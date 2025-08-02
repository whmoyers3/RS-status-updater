// Debug script to test Supabase queries directly
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('Environment check:')
console.log('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set (length: ' + supabaseAnonKey.length + ')' : 'Missing')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSupabaseQueries() {
  console.log('\n=== Testing Supabase Queries ===\n')

  try {
    // Test 1: Check fieldworkers table
    console.log('1. Testing fieldworkers query...')
    const { data: fieldworkers, error: fwError } = await supabase
      .from('fieldworkers')
      .select('id, full_name')
      .order('full_name')
    
    if (fwError) {
      console.error('❌ Fieldworkers error:', fwError)
    } else {
      console.log('✅ Fieldworkers found:', fieldworkers.length)
      if (fieldworkers.length > 0) {
        console.log('   Sample fieldworkers:', fieldworkers.slice(0, 3))
      } else {
        console.log('   ⚠️  No fieldworkers returned!')
      }
    }

    // Test 2: Check rs_status_lookup table
    console.log('\n2. Testing status lookup query...')
    const { data: statuses, error: statusError } = await supabase
      .from('rs_status_lookup')
      .select('*')
      .order('status_description')
    
    if (statusError) {
      console.error('❌ Status lookup error:', statusError)
    } else {
      console.log('✅ Statuses found:', statuses.length)
      if (statuses.length > 0) {
        console.log('   Sample statuses:', statuses.slice(0, 3).map(s => ({ id: s.status_id, desc: s.status_description })))
      } else {
        console.log('   ⚠️  No statuses returned!')
      }
    }

    // Test 3: Check rs_work_orders table structure and count
    console.log('\n3. Testing work orders query...')
    const { data: workOrders, error: woError } = await supabase
      .from('rs_work_orders')
      .select('*')
      .limit(5)
    
    if (woError) {
      console.error('❌ Work orders error:', woError)
    } else {
      console.log('✅ Work orders sample found:', workOrders.length)
      if (workOrders.length > 0) {
        const firstOrder = workOrders[0]
        console.log('   Sample work order fields:', Object.keys(firstOrder))
        console.log('   Field worker ID field:', firstOrder.rs_field_worker_id)
        console.log('   Status ID field:', firstOrder.rs_status_id)
      } else {
        console.log('   ⚠️  No work orders returned!')
      }
    }

    // Test 4: Count work orders with field worker ID = 1 (Will Moyers)
    console.log('\n4. Testing filtered work orders count...')
    const { count, error: countError } = await supabase
      .from('rs_work_orders')
      .select('rs_id', { count: 'exact', head: true })
      .eq('rs_field_worker_id', 1)
    
    if (countError) {
      console.error('❌ Work orders count error:', countError)
    } else {
      console.log('✅ Work orders for field worker 1:', count)
    }

    // Test 5: Test work orders with incomplete status filter
    console.log('\n5. Testing incomplete work orders...')
    const { data: incompleteWorkOrders, error: incompleteError } = await supabase
      .from('rs_work_orders')
      .select(`
        *,
        rs_status_lookup!inner(status_id, status_description, is_complete)
      `)
      .eq('rs_status_lookup.is_complete', false)
      .limit(5)
    
    if (incompleteError) {
      console.error('❌ Incomplete work orders error:', incompleteError)
    } else {
      console.log('✅ Incomplete work orders found:', incompleteWorkOrders.length)
    }

    // Test 6: Test manual join approach (current implementation)
    console.log('\n6. Testing manual join approach...')
    
    // Get work orders
    const { data: rawWorkOrders, error: rawError } = await supabase
      .from('rs_work_orders')
      .select('*')
      .eq('rs_field_worker_id', 1)
      .limit(10)
    
    if (rawError) {
      console.error('❌ Raw work orders error:', rawError)
      return
    }

    console.log('✅ Raw work orders for field worker 1:', rawWorkOrders.length)

    if (rawWorkOrders.length > 0) {
      // Test the manual join
      const statusMap = new Map(statuses.map(status => [status.status_id, status]))
      const fieldworkerMap = new Map(fieldworkers.map(fw => [fw.id, fw]))

      const enrichedOrders = rawWorkOrders.map(workOrder => ({
        ...workOrder,
        rs_status_lookup: statusMap.get(workOrder.rs_status_id) || null,
        fieldworkers: fieldworkerMap.get(workOrder.rs_field_worker_id) || null
      }))

      console.log('   Manual join results:')
      enrichedOrders.forEach(order => {
        console.log(`   - Order ${order.rs_id}: Status=${order.rs_status_lookup?.status_description || 'Unknown'}, Worker=${order.fieldworkers?.full_name || 'Unassigned'}`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testSupabaseQueries()
