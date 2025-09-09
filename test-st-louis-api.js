#!/usr/bin/env node

/**
 * Test script to verify St. Louis VC search returns 375+ results
 * This tests the new /api/ask/browse endpoint
 */

const BASE_URL = 'https://ria-hunter-lbss3xb0g-turnerpeters-6002s-projects.vercel.app';

async function testBrowseEndpoint() {
  console.log('🧪 Testing /api/ask/browse endpoint for St. Louis VC RIAs...\n');
  
  try {
    const params = new URLSearchParams({
      state: 'MO',
      city: 'St. Louis', 
      hasVcActivity: 'true',
      limit: '100',
      sortBy: 'aum',
      sortOrder: 'desc'
    });
    
    const url = `${BASE_URL}/api/ask/browse?${params}`;
    console.log(`📍 Request URL: ${url}\n`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ API returned status ${response.status}`);
      const text = await response.text();
      console.error('Response:', text);
      return false;
    }
    
    const data = await response.json();
    
    // Check if we have results
    if (!data.results || !data.pagination) {
      console.error('❌ Invalid response structure');
      console.log('Response:', JSON.stringify(data, null, 2));
      return false;
    }
    
    const totalResults = data.pagination.total;
    const pageResults = data.results.length;
    
    console.log('📊 Results Summary:');
    console.log(`   Total RIAs with VC activity: ${totalResults}`);
    console.log(`   Results on this page: ${pageResults}`);
    console.log(`   Total pages: ${Math.ceil(totalResults / data.pagination.limit)}\n`);
    
    // Check if we got the expected 375+ results
    if (totalResults >= 375) {
      console.log('✅ SUCCESS: Found 375+ RIAs with VC activity as expected!');
      console.log(`   Actual count: ${totalResults} RIAs\n`);
    } else {
      console.log('❌ FAILURE: Expected 375+ RIAs but only found ' + totalResults);
      console.log('   This indicates the backend fix may not be working properly.\n');
      return false;
    }
    
    // Show top 5 RIAs by AUM
    console.log('🏢 Top 5 RIAs by AUM:');
    data.results.slice(0, 5).forEach((ria, idx) => {
      const aum = ria.aum ? `$${(ria.aum / 1e9).toFixed(2)}B` : 'N/A';
      console.log(`   ${idx + 1}. ${ria.legal_name}`);
      console.log(`      Location: ${ria.city}, ${ria.state}`);
      console.log(`      AUM: ${aum}`);
      console.log(`      Private Funds: ${ria.private_fund_count || 0}`);
      console.log(`      CRD: ${ria.crd_number}\n`);
    });
    
    // Check for known RIAs
    const knownRIAs = ['EDWARD JONES', 'WELLS FARGO', 'STIFEL', 'MONETA'];
    const foundRIAs = knownRIAs.filter(name => 
      data.results.some(ria => ria.legal_name?.toUpperCase().includes(name))
    );
    
    if (foundRIAs.length > 0) {
      console.log('✅ Found expected major RIAs:', foundRIAs.join(', '));
    } else {
      console.log('⚠️  Warning: Did not find expected major RIAs in first page');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

async function testSearchEndpoint() {
  console.log('\n🧪 Testing /api/ask endpoint for St. Louis VC search...\n');
  
  try {
    const requestBody = {
      query: 'RIAs with venture capital or private equity activity', 
      filters: {
        state: 'MO',
        city: 'St. Louis',
        hasVcActivity: true
      },
      limit: 200
    };
    
    const url = `${BASE_URL}/api/ask`;
    console.log(`📍 Request URL: ${url}`);
    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2), '\n');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.error(`❌ API returned status ${response.status}`);
      const text = await response.text();
      console.error('Response:', text);
      return false;
    }
    
    const data = await response.json();
    
    // Check results
    const resultCount = data.results?.length || 0;
    
    console.log('📊 Results Summary:');
    console.log(`   Results returned: ${resultCount}`);
    
    if (data.totalResults) {
      console.log(`   Total results available: ${data.totalResults}`);
    }
    
    if (data.metadata?.filteredCount) {
      console.log(`   Filtered count: ${data.metadata.filteredCount}`);
    }
    
    if (resultCount >= 100) {
      console.log('\n✅ SUCCESS: Found 100+ RIAs in search results!');
      console.log(`   This indicates the search is working properly.\n`);
    } else if (resultCount > 0) {
      console.log(`\n⚠️  WARNING: Only found ${resultCount} RIAs, expected 100+\n`);
    } else {
      console.log('\n❌ FAILURE: No results found!\n');
      return false;
    }
    
    // Show natural language answer if provided
    if (data.answer) {
      console.log('🤖 AI Response:');
      console.log('   ' + data.answer.substring(0, 200) + '...\n');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('ST. LOUIS VC SEARCH TEST - VERIFYING 375+ RESULTS FIX');
  console.log('='.repeat(60));
  
  const browseSuccess = await testBrowseEndpoint();
  const searchSuccess = await testSearchEndpoint();
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Browse endpoint: ${browseSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Search endpoint: ${searchSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (browseSuccess && searchSuccess) {
    console.log('\n🎉 All tests passed! The St. Louis VC search is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the backend implementation.');
    process.exit(1);
  }
}

runTests();
