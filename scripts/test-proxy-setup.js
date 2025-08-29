#!/usr/bin/env node

/**
 * Test script to verify the API proxy configuration
 * Run this after deploying to verify all endpoints work correctly
 */

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testEndpoint(path, options = {}) {
  const url = `${API_BASE}${path}`;
  console.log(`\n📍 Testing: ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log(`   ✅ Success:`, JSON.stringify(data, null, 2).substring(0, 200));
      } else {
        console.log(`   ✅ Success (non-JSON response)`);
      }
    } else {
      const text = await response.text();
      console.log(`   ⚠️  Response:`, text.substring(0, 200));
    }
    
    return response.status;
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return -1;
  }
}

async function runTests() {
  console.log('🧪 Testing API Proxy Configuration');
  console.log('================================');
  console.log(`Base URL: ${API_BASE}`);
  
  // Test session status (no auth required)
  await testEndpoint('/api/session/status', {
    method: 'GET'
  });
  
  // Test health endpoint
  await testEndpoint('/api/health', {
    method: 'GET'
  });
  
  // Test balance endpoint (works without auth)
  await testEndpoint('/api/balance', {
    method: 'GET'
  });
  
  // Test alternative balance endpoint
  await testEndpoint('/api/credits/balance', {
    method: 'GET'
  });
  
  // Test main search endpoint (POST required)
  await testEndpoint('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ query: 'test query' })
  });
  
  // Test profile endpoint (should return 404 for invalid ID)
  await testEndpoint('/api/v1/ria/profile/test-id', {
    method: 'GET'
  });
  
  console.log('\n✨ Proxy test complete!');
  console.log('Note: Some endpoints may return errors if auth is required.');
  console.log('The important thing is that they\'re being reached (not 404 from proxy).');
}

// Run tests
runTests().catch(console.error);
