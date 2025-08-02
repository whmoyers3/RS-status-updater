// Test API script to debug the issue
const RAZORSYNC_CONFIG = {
  token: '4442a145-bf1b-4cc4-bfd1-026587d5b037',
  host: 'vallus.0.razorsync.com',
  serverName: 'vallus',
  baseUrl: 'https://vallus.0.razorsync.com/ApiService.svc'
}

const testWorkOrder = async (workOrderId) => {
  const url = `${RAZORSYNC_CONFIG.baseUrl}/WorkOrder/${workOrderId}`
  
  const headers = {
    'Content-Type': 'application/json',
    'Token': RAZORSYNC_CONFIG.token,
    'Host': RAZORSYNC_CONFIG.host,
    'ServerName': RAZORSYNC_CONFIG.serverName,
    'Connection': 'Keep-Alive'
  }

  console.log(`🌐 Testing GET ${url}`)
  console.log(`📋 Headers:`, headers)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    })
    
    console.log(`📊 Response status: ${response.status}`)
    console.log(`📊 Response ok: ${response.ok}`)
    console.log(`📊 Content-Type: ${response.headers.get('content-type')}`)
    console.log(`📊 Content-Length: ${response.headers.get('content-length')}`)
    
    if (response.headers.get('content-length') === '0') {
      console.log(`⚠️  Empty response detected - work order likely doesn't exist`)
      return null
    }
    
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json()
      console.log(`✅ Success! Data:`, data)
      return data
    }
    
    console.log(`❌ Unexpected response`)
    return null
    
  } catch (error) {
    console.error(`❌ Fetch error:`, error)
    throw error
  }
}

// Test with work order 60254
console.log('🚀 Starting API test...')
testWorkOrder('60254')
  .then(result => {
    console.log('🎉 Test completed successfully:', result ? 'FOUND' : 'NOT FOUND')
  })
  .catch(error => {
    console.error('💥 Test failed:', error)
  })
