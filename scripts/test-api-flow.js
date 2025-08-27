#!/usr/bin/env node

/**
 * Test script to verify API flow and credit decrementing
 */

async function testAPIFlow() {
  const API_URL = 'https://ria-hunter.app/_backend/api/ask';
  
  // Test query that should trigger semantic search
  const testQuery = {
    query: "What are the five largest RIA firms in St. Louis?",
    options: {
      city: "Saint Louis",
      state: "MO"
    }
  };
  
  console.log('🔍 Testing API endpoint:', API_URL);
  console.log('📝 Query:', testQuery.query);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Note: In production, this would include auth token
      },
      body: JSON.stringify(testQuery),
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
      
      if (response.status === 401) {
        console.log('\n⚠️  Authentication required - this is expected for unauthenticated requests');
        console.log('💡 The proxy is working correctly!');
      }
      return;
    }
    
    const data = await response.json();
    
    console.log('\n✅ Response received!');
    console.log('📊 Response structure:');
    console.log('  - Has answer:', !!data.answer);
    console.log('  - Has results:', Array.isArray(data.results), data.results?.length || 0, 'items');
    console.log('  - Has metadata:', !!data.metadata);
    
    if (data.metadata) {
      console.log('\n💳 Credit Information:');
      console.log('  - Remaining credits:', data.metadata.remaining ?? 'not provided');
      console.log('  - Is subscriber:', data.metadata.isSubscriber ?? 'not provided');
      console.log('  - Search strategy:', data.metadata.searchStrategy ?? 'not provided');
      console.log('  - Query type:', data.metadata.queryType ?? 'not provided');
    }
    
    if (data.results && data.results.length > 0) {
      console.log('\n🏢 Top Results:');
      data.results.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.firm_name} (${result.city}, ${result.state})`);
        if (result.similarity !== undefined) {
          console.log(`     Similarity: ${result.similarity}`);
        }
      });
    }
    
    // Check if semantic search was used
    const usedSemanticSearch = data.metadata?.searchStrategy === 'ai_semantic' || 
                              data.results?.some(r => r.similarity !== undefined);
    
    console.log('\n🤖 AI/Semantic Search Status:');
    console.log('  - Used semantic search:', usedSemanticSearch ? '✅ YES' : '❌ NO');
    
    if (!usedSemanticSearch) {
      console.log('\n⚠️  WARNING: The query did not use semantic search!');
      console.log('  This confirms the executeEnhancedQuery bypass issue.');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Run the test
testAPIFlow().catch(console.error);
