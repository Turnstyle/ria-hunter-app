#!/usr/bin/env node

/**
 * RIA Hunter API Test Suite
 * Tests all endpoints to ensure they work with the real database schema
 */

const fetch = require('node-fetch').default || require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Test configurations
const tests = [
  {
    name: 'Search API - GET with location filter',
    method: 'GET',
    url: `${BASE_URL}/api/ria-hunter/search?location=St.%20Louis&privateInvestment=false`,
    expectedStatus: 200,
    validate: (data) => {
      return Array.isArray(data.data) && data.receivedParams && data.receivedParams.location === 'St. Louis';
    }
  },
  {
    name: 'Search API - GET with private investment filter',
    method: 'GET',
    url: `${BASE_URL}/api/ria-hunter/search?privateInvestment=true`,
    expectedStatus: 200,
    validate: (data) => {
      return Array.isArray(data.data) && data.receivedParams && data.receivedParams.privateInvestment === 'true';
    }
  },
  {
    name: 'Search API - POST with natural language query',
    method: 'POST',
    url: `${BASE_URL}/api/ria-hunter/search`,
    body: {
      query: "Find investment advisers in Missouri that manage private funds"
    },
    expectedStatus: 200,
    validate: (data) => {
      return Array.isArray(data.results) && data.naturalLanguageQuery && data.aiExtractedParams;
    }
  },
  {
    name: 'Match Thesis API - POST',
    method: 'POST',
    url: `${BASE_URL}/api/ria-hunter/match-thesis`,
    body: {
      thesis: "Looking for investment managers focused on technology growth stocks and private equity in the healthcare sector"
    },
    expectedStatus: 200,
    validate: (data) => {
      return data.receivedThesis && Array.isArray(data.keywords) && Array.isArray(data.keywordMatches);
    }
  },
  {
    name: 'Profile API - GET (using sample CIK)',
    method: 'GET',
    url: `${BASE_URL}/api/ria-hunter/profile/123456789`, // This will likely fail with 404, which is expected
    expectedStatus: [404, 200], // Accept either 404 (no data) or 200 (data found)
    validate: (data) => {
      return data.error === 'RIA profile not found' || (data.cik && data.legal_name);
    }
  }
];

// Helper function to make HTTP requests
async function makeRequest(test) {
  const options = {
    method: test.method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (test.body) {
    options.body = JSON.stringify(test.body);
  }

  try {
    const response = await fetch(test.url, options);
    const data = await response.json();

    return {
      status: response.status,
      data: data,
      success: Array.isArray(test.expectedStatus)
        ? test.expectedStatus.includes(response.status)
        : response.status === test.expectedStatus
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Running RIA Hunter API Tests...\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    console.log(`  ${test.method} ${test.url}`);

    const result = await makeRequest(test);

    if (result.success) {
      if (test.validate && !test.validate(result.data)) {
        console.log(`  ❌ FAILED - Invalid response structure`);
        console.log(`     Status: ${result.status}`);
        console.log(`     Response:`, JSON.stringify(result.data, null, 2));
        failed++;
      } else {
        console.log(`  ✅ PASSED`);
        console.log(`     Status: ${result.status}`);
        console.log(`     Response preview:`, JSON.stringify(result.data, null, 2).substring(0, 200) + '...');
        passed++;
      }
    } else {
      console.log(`  ❌ FAILED`);
      console.log(`     Expected status: ${test.expectedStatus}, Got: ${result.status}`);
      console.log(`     Response:`, JSON.stringify(result.data, null, 2));
      failed++;
    }

    console.log('');
  }

  console.log('📊 Test Results:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📋 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! RIA Hunter API is working correctly.');
    process.exit(0);
  } else {
    console.log(`\n💥 ${failed} test(s) failed. Please check the API implementation.`);
    process.exit(1);
  }
}

// Health check first
async function healthCheck() {
  console.log('🔍 Performing health check...');

  try {
    const response = await fetch(`${BASE_URL}/api/ria-hunter/search?privateInvestment=false`);
    if (response.status === 200) {
      console.log('✅ API server is responding\n');
      return true;
    } else {
      console.log(`❌ API server returned status ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Cannot connect to API server: ${error.message}`);
    console.log('   Make sure the app is running on http://localhost:3000\n');
    return false;
  }
}

// Main execution
async function main() {
  const isHealthy = await healthCheck();

  if (!isHealthy) {
    console.log('💡 Start the server with: npm run dev');
    process.exit(1);
  }

  await runTests();
}

main().catch(console.error);
