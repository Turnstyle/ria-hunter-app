// Test script to verify ETL data is in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testDatabase() {
  console.log(' Testing Supabase Connection...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Test 1: Check if advisers table exists and has data
    console.log('\n Checking advisers table...');
    const { data: advisers, error: advisersError, count } = await supabase
      .from('advisers')
      .select('*', { count: 'exact' })
      .limit(5);

    if (advisersError) {
      console.error(' Error accessing advisers table:', advisersError.message);
    } else {
      console.log(' Advisers table found!');
      console.log( Total advisers: );
      console.log(' Sample adviser data available');
    }

    // Test 2: Check filings table  
    console.log('\n Checking filings table...');
    const { data: filings, error: filingsError, count: filingsCount } = await supabase
      .from('filings')
      .select('*', { count: 'exact' })
      .limit(3);

    if (filingsError) {
      console.error(' Error accessing filings table:', filingsError.message);
    } else {
      console.log(' Filings table found!');
      console.log( Total filings: );
    }

  } catch (error) {
    console.error(' Database test failed:', error.message);
  }
}

testDatabase();
