#!/usr/bin/env node

/**
 * Test script to verify the proxy configuration is working correctly
 * This tests if the backend endpoints are accessible through the frontend proxy
 */

const https = require('https');

// Test configuration
const FRONTEND_URL = 'https://ria-hunter.app';
const TEST_ENDPOINTS = [
  '/_backend/api/ask',
  '/_backend/api/ask-stream',
  '/_backend/api/session/status',
  '/_backend/api/health'
];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test a single endpoint
async function testEndpoint(endpoint, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const url = new URL(endpoint, FRONTEND_URL);
    
    console.log(`${colors.cyan}Testing: ${method} ${url.href}${colors.reset}`);
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RIA-Hunter-Proxy-Test/1.0'
      }
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const status = res.statusCode;
        const success = status >= 200 && status < 500; // Not a server error
        
        if (success) {
          if (status === 401) {
            console.log(`  ${colors.yellow}✓ Status: ${status} (Authentication required - endpoint exists!)${colors.reset}`);
          } else if (status === 400) {
            console.log(`  ${colors.yellow}✓ Status: ${status} (Bad request - endpoint exists!)${colors.reset}`);
          } else if (status === 404) {
            console.log(`  ${colors.red}✗ Status: ${status} (Not found - endpoint missing)${colors.reset}`);
          } else {
            console.log(`  ${colors.green}✓ Status: ${status} (Success!)${colors.reset}`);
          }
        } else {
          console.log(`  ${colors.red}✗ Status: ${status} (Server error)${colors.reset}`);
        }
        
        // Show response preview for debugging
        if (data) {
          const preview = data.substring(0, 100);
          console.log(`  Response preview: ${preview}${data.length > 100 ? '...' : ''}`);
        }
        
        resolve({ endpoint, status, success, data });
      });
    });
    
    req.on('error', (error) => {
      console.log(`  ${colors.red}✗ Error: ${error.message}${colors.reset}`);
      resolve({ endpoint, status: 0, success: false, error: error.message });
    });
    
    if (body && method === 'POST') {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Run all tests
async function runTests() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}   RIA Hunter Backend Proxy Configuration Test${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  console.log(`Testing against: ${FRONTEND_URL}`);
  console.log(`Proxy should forward /_backend/* to backend API\n`);
  
  const results = [];
  
  // Test GET endpoints
  console.log(`${colors.yellow}▶ Testing GET endpoints:${colors.reset}\n`);
  for (const endpoint of ['/_backend/api/session/status', '/_backend/api/health']) {
    const result = await testEndpoint(endpoint, 'GET');
    results.push(result);
    console.log('');
  }
  
  // Test POST endpoints  
  console.log(`${colors.yellow}▶ Testing POST endpoints:${colors.reset}\n`);
  
  // Test /api/ask endpoint
  const askResult = await testEndpoint('/_backend/api/ask', 'POST', {
    query: 'Show me RIA firms in Missouri',
    options: { maxResults: 5 }
  });
  results.push(askResult);
  console.log('');
  
  // Test /api/ask-stream endpoint
  const askStreamResult = await testEndpoint('/_backend/api/ask-stream', 'POST', {
    query: 'Show me largest RIA firms',
    options: { maxResults: 5 }
  });
  results.push(askStreamResult);
  console.log('');
  
  // Summary
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}   Test Summary${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  const working = results.filter(r => r.status !== 404 && r.status !== 0);
  const notFound = results.filter(r => r.status === 404);
  const errors = results.filter(r => r.status === 0);
  
  console.log(`${colors.green}✓ Working endpoints: ${working.length}/${results.length}${colors.reset}`);
  working.forEach(r => {
    console.log(`  - ${r.endpoint} (${r.status})`);
  });
  
  if (notFound.length > 0) {
    console.log(`\n${colors.red}✗ Missing endpoints: ${notFound.length}${colors.reset}`);
    notFound.forEach(r => {
      console.log(`  - ${r.endpoint}`);
    });
  }
  
  if (errors.length > 0) {
    console.log(`\n${colors.red}✗ Connection errors: ${errors.length}${colors.reset}`);
    errors.forEach(r => {
      console.log(`  - ${r.endpoint}: ${r.error}`);
    });
  }
  
  // Final verdict
  console.log('');
  if (working.length === results.length) {
    console.log(`${colors.green}✅ SUCCESS: All endpoints are accessible through the proxy!${colors.reset}`);
    console.log(`The proxy configuration is working correctly.`);
  } else if (working.length > 0) {
    console.log(`${colors.yellow}⚠️  PARTIAL: Some endpoints work, but not all${colors.reset}`);
    console.log(`The proxy may be partially configured or some endpoints don't exist.`);
  } else {
    console.log(`${colors.red}❌ FAILURE: No endpoints are accessible${colors.reset}`);
    console.log(`The proxy configuration may be incorrect or the backend is down.`);
  }
}

// Execute tests
runTests().catch(console.error);
