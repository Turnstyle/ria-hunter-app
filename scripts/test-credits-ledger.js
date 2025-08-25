#!/usr/bin/env node
/**
 * Credits Ledger Test Script
 * 
 * This script tests the credits ledger functionality by:
 * 1. Connecting to the database
 * 2. Creating a test user
 * 3. Performing various credit operations
 * 4. Verifying the credit balance
 * 
 * Usage:
 * node test-credits-ledger.js
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('crypto');

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration
const TEST_USER_ID = `test-${Date.now()}`;
const OPERATIONS = [
  { type: 'add', amount: 10, source: 'migration', refType: 'test', refId: 'initial' },
  { type: 'deduct', amount: 3, source: 'usage', refType: 'ask', refId: 'test-query-1' },
  { type: 'add', amount: 5, source: 'coupon', refType: 'test', refId: 'bonus' },
  { type: 'deduct', amount: 2, source: 'usage', refType: 'search', refId: 'test-search-1' },
  // Duplicate operation (should be idempotent)
  { type: 'add', amount: 5, source: 'coupon', refType: 'test', refId: 'bonus' },
  // Attempt to deduct more than available (should fail)
  { type: 'deduct', amount: 20, source: 'usage', refType: 'test', refId: 'too-much' },
];

// Helper functions
function generateIdempotencyKey(userId, operation, refId) {
  return createHash('sha256')
    .update(`${userId}-${operation}-${refId}`)
    .digest('hex');
}

async function addCredits(userId, amount, options) {
  const idempotencyKey = options.idempotencyKey || 
    generateIdempotencyKey(userId, `add-${options.refType}`, options.refId);

  try {
    // Check if this operation has already been processed
    const existingEntry = await prisma.creditsLedger.findUnique({
      where: { idempotencyKey }
    });

    if (existingEntry) {
      console.log('Operation already processed (idempotent):', idempotencyKey);
      const balance = await getBalance(userId);
      return balance;
    }

    // Add new ledger entry
    await prisma.creditsLedger.create({
      data: {
        id: uuidv4(),
        userId,
        delta: amount,
        source: options.source,
        refType: options.refType,
        refId: options.refId,
        idempotencyKey,
        metadata: options.metadata || {},
      }
    });

    // Update or create the account with the new balance
    const totalBalance = await recalculateBalance(userId);
    return totalBalance;
  } catch (error) {
    console.error('Error adding credits:', error);
    throw error;
  }
}

async function deductCredits(userId, amount, options) {
  const idempotencyKey = options.idempotencyKey || 
    generateIdempotencyKey(userId, `deduct-${options.refType}`, options.refId);

  try {
    // Check if this operation has already been processed
    const existingEntry = await prisma.creditsLedger.findUnique({
      where: { idempotencyKey }
    });

    if (existingEntry) {
      console.log('Operation already processed (idempotent):', idempotencyKey);
      const balance = await getBalance(userId);
      return balance;
    }

    // Check current balance
    const currentBalance = await getBalance(userId);
    
    // Only allow negative balance for admin adjustments
    if (currentBalance < amount && options.source !== 'admin_adjust') {
      throw new Error(`Insufficient credits: current=${currentBalance}, requested=${amount}`);
    }

    // Add negative ledger entry
    await prisma.creditsLedger.create({
      data: {
        id: uuidv4(),
        userId,
        delta: -amount, // Negative amount for deduction
        source: options.source,
        refType: options.refType,
        refId: options.refId,
        idempotencyKey,
        metadata: options.metadata || {},
      }
    });

    // Update the account with the new balance
    const newBalance = await recalculateBalance(userId);
    return newBalance;
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw error;
  }
}

async function getBalance(userId) {
  try {
    // Try to get from account cache first
    const account = await prisma.creditsAccount.findUnique({
      where: { userId }
    });

    if (account) {
      return account.balanceCache;
    }

    // Calculate from ledger if no account exists
    return await recalculateBalance(userId);
  } catch (error) {
    console.error('Error getting credit balance:', error);
    throw error;
  }
}

async function recalculateBalance(userId) {
  try {
    // Sum all ledger entries
    const result = await prisma.creditsLedger.aggregate({
      where: { userId },
      _sum: { delta: true }
    });

    const balance = result._sum.delta || 0;

    // Update or create the account cache
    await prisma.creditsAccount.upsert({
      where: { userId },
      update: { 
        balanceCache: balance,
        updatedAt: new Date()
      },
      create: {
        userId,
        balanceCache: balance
      }
    });

    return balance;
  } catch (error) {
    console.error('Error recalculating balance:', error);
    throw error;
  }
}

async function getLedgerEntries(userId) {
  try {
    const entries = await prisma.creditsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return entries;
  } catch (error) {
    console.error('Error getting ledger entries:', error);
    throw error;
  }
}

async function cleanup(userId) {
  try {
    // Delete all ledger entries for this test user
    await prisma.creditsLedger.deleteMany({
      where: { userId }
    });

    // Delete the account for this test user
    await prisma.creditsAccount.deleteMany({
      where: { userId }
    });

    console.log(`Cleaned up test data for user ${userId}`);
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Main test function
async function runTest() {
  console.log('Starting Credits Ledger Test');
  console.log('==========================');
  console.log(`Test User ID: ${TEST_USER_ID}`);
  
  try {
    // Ensure test user starts with no credits
    await cleanup(TEST_USER_ID);
    let balance = await getBalance(TEST_USER_ID);
    console.log(`Initial balance: ${balance}`);
    
    // Perform operations
    console.log('\nPerforming test operations:');
    for (const op of OPERATIONS) {
      try {
        console.log(`\n-> ${op.type} ${op.amount} credits (${op.source}/${op.refType}/${op.refId})`);
        
        const idempotencyKey = generateIdempotencyKey(
          TEST_USER_ID, 
          `${op.type}-${op.refType}`, 
          op.refId
        );
        
        if (op.type === 'add') {
          balance = await addCredits(TEST_USER_ID, op.amount, {
            source: op.source,
            refType: op.refType,
            refId: op.refId,
            idempotencyKey,
            metadata: { test: true }
          });
        } else {
          balance = await deductCredits(TEST_USER_ID, op.amount, {
            source: op.source,
            refType: op.refType,
            refId: op.refId,
            idempotencyKey,
            metadata: { test: true }
          });
        }
        
        console.log(`  Success! New balance: ${balance}`);
      } catch (error) {
        console.log(`  Failed: ${error.message}`);
      }
    }
    
    // Get final ledger entries
    console.log('\nFinal ledger entries:');
    const entries = await getLedgerEntries(TEST_USER_ID);
    
    console.log('\n------------------------------------------');
    console.log('| Date               | Source    | Type   | Amount | Reference   |');
    console.log('|-------------------|-----------|--------|--------|-------------|');
    
    for (const entry of entries) {
      const date = entry.createdAt.toISOString().slice(0, 19).replace('T', ' ');
      const source = entry.source.padEnd(9);
      const type = entry.refType.padEnd(6);
      const amount = entry.delta > 0 ? `+${entry.delta}` : entry.delta.toString();
      const amountStr = amount.padStart(6);
      const ref = entry.refId.padEnd(11);
      
      console.log(`| ${date} | ${source} | ${type} | ${amountStr} | ${ref} |`);
    }
    
    console.log('------------------------------------------');
    
    // Final balance check
    const finalBalance = await getBalance(TEST_USER_ID);
    console.log(`\nFinal balance: ${finalBalance}`);
    
    // Verify balance matches ledger sum
    const manualSum = entries.reduce((sum, entry) => sum + entry.delta, 0);
    console.log(`Manual sum of ledger entries: ${manualSum}`);
    console.log(`Balance matches ledger sum: ${finalBalance === manualSum ? 'YES' : 'NO'}`);
    
    // Cleanup
    if (process.env.NO_CLEANUP !== 'true') {
      console.log('\nCleaning up test data...');
      await cleanup(TEST_USER_ID);
    } else {
      console.log('\nSkipping cleanup, test data remains in database');
    }
    
    console.log('\nTest complete!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runTest();
