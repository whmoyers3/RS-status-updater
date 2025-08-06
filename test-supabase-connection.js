// Test Supabase connection and RC homes data
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key:', supabaseAnonKey ? 'Present' : 'Missing')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test connection
async function testConnection() {
  try {
    console.log('\n1. Testing basic connection...')
    const { data, error } = await supabase.from('rs_work_orders').select('rs_id').limit(1)
    if (error) {
      console.error('Connection error:', error)
      return false
    }
    console.log('✅ Basic connection successful')
    
    console.log('\n2. Testing RC matching lookup...')
    const { data: matchingData, error: matchingError } = await supabase
      .from('rc_rs_matching_lookup')
      .select('rs_service_request_id, rc_home_id')
      .not('rs_service_request_id', 'is', null)
      .not('rc_home_id', 'is', null)
      .limit(5)
    
    if (matchingError) {
      console.error('Matching lookup error:', matchingError)
      return false
    }
    
    console.log('✅ RC matching lookup successful')
    console.log('Sample matching data:', matchingData)
    
    console.log('\n3. Testing RC homes data...')
    if (matchingData && matchingData.length > 0) {
      const rcHomeIds = [...new Set(matchingData.map(item => item.rc_home_id).filter(Boolean))]
      console.log('RC Home IDs to query:', rcHomeIds)
      
      const { data: rcHomesData, error: homesError } = await supabase
        .from('rc_homes