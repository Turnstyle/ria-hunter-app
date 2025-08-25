// @ts-nocheck
// app/lib/credits-ledger.ts
// Credits ledger service for managing user credits
// Follows the ledger pattern for idempotent credit operations

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { getServerSupabaseClient } from './supabase-server';
import { randomBytes } from 'crypto';

// Initialize Prisma client
const prisma = new PrismaClient();

// Export CreditsSource enum for use in other files
export enum CreditsSource {
  USAGE = 'usage',
  SUBSCRIPTION = 'subscription',
  COUPON = 'coupon',
  ADMIN_ADJUST = 'admin_adjust',
  REFUND = 'refund',
  MIGRATION = 'migration'
}

/**
 * Interface for credit operation options
 */
export interface CreditOperationOptions {
  // Source of the credits operation
  source: CreditsSource;
  // Reference type (e.g., 'ask', 'stripe_invoice', 'coupon_code')
  refType: string;
  // Stable reference ID (e.g., stripe event ID, request ID)
  refId: string;
  // Optional idempotency key (generated if not provided)
  idempotencyKey?: string;
  // Optional metadata
  metadata?: Record<string, any>;
}

/**
 * Interface for credit balance result
 */
export interface CreditBalance {
  balance: number;
  isSubscriber: boolean;
}

/**
 * Interface for ledger entry
 */
export interface LedgerEntry {
  id: string;
  userId: string;
  delta: number;
  source: string;
  refType: string;
  refId: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Generate a deterministic, stable anonymous ID for non-authenticated users
 * based on their cookie or other identifier
 */
export function generateStableAnonId(identifier: string): string {
  return createHash('sha256')
    .update(`ria-hunter-anon-${identifier}`)
    .digest('hex');
}

/**
 * Generate an idempotency key for a credit operation
 */
function generateIdempotencyKey(userId: string, operation: string, refId: string): string {
  return createHash('sha256')
    .update(`${userId}-${operation}-${refId}-${randomBytes(8).toString('hex')}`)
    .digest('hex');
}

/**
 * Add credits to a user's balance
 */
export async function addCredits(
  userId: string,
  amount: number,
  options: CreditOperationOptions
): Promise<number> {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  const idempotencyKey = options.idempotencyKey || 
    generateIdempotencyKey(userId, `add-${options.refType}`, options.refId);

  try {
    // Check if this operation has already been processed
    const existingEntry = await prisma.creditsLedger.findUnique({
      where: { idempotencyKey }
    });

    if (existingEntry) {
      // Operation already processed, return current balance
      const balance = await getBalance(userId);
      return balance;
    }

    // Add new ledger entry
    await prisma.creditsLedger.create({
      data: {
        id: uuidv4(),
        userId,
        delta: amount,
        source: options.source.toString(),
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

/**
 * Deduct credits from a user's balance
 */
export async function deductCredits(
  userId: string,
  amount: number,
  options: CreditOperationOptions
): Promise<number> {
  if (amount <= 0) {
    throw new Error('Deduction amount must be positive');
  }

  const idempotencyKey = options.idempotencyKey || 
    generateIdempotencyKey(userId, `deduct-${options.refType}`, options.refId);

  try {
    // Check if this operation has already been processed
    const existingEntry = await prisma.creditsLedger.findUnique({
      where: { idempotencyKey }
    });

    if (existingEntry) {
      // Operation already processed, return current balance
      const balance = await getBalance(userId);
      return balance;
    }

    // Check current balance
    const currentBalance = await getBalance(userId);
    
    // Only allow negative balance for admin adjustments
    if (currentBalance < amount && options.source !== CreditsSource.ADMIN_ADJUST) {
      throw new Error(`Insufficient credits: current=${currentBalance}, requested=${amount}`);
    }

    // Add negative ledger entry
    await prisma.creditsLedger.create({
      data: {
        id: uuidv4(),
        userId,
        delta: -amount, // Negative amount for deduction
        source: options.source.toString(),
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

/**
 * Get a user's current credit balance
 */
export async function getBalance(userId: string): Promise<number> {
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

/**
 * Get a user's credit balance and subscription status
 */
export async function getCreditsStatus(userId: string): Promise<CreditBalance> {
  try {
    // Get credit balance
    const balance = await getBalance(userId);

    // Check subscription status
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    const now = new Date();
    const isSubscriber = subscription && 
      (subscription.status === 'active' || subscription.status === 'trialing') &&
      (!subscription.currentPeriodEnd || new Date(subscription.currentPeriodEnd) > now);

    return {
      balance,
      isSubscriber: !!isSubscriber
    };
  } catch (error) {
    console.error('Error getting credits status:', error);
    throw error;
  }
}

/**
 * Get recent ledger entries for a user
 */
export async function getLedgerEntries(
  userId: string,
  limit: number = 20
): Promise<LedgerEntry[]> {
  try {
    const entries = await prisma.creditsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return entries.map(entry => ({
      id: entry.id,
      userId: entry.userId,
      delta: entry.delta,
      source: entry.source,
      refType: entry.refType,
      refId: entry.refId,
      metadata: entry.metadata as Record<string, any>,
      createdAt: entry.createdAt
    }));
  } catch (error) {
    console.error('Error getting ledger entries:', error);
    throw error;
  }
}

/**
 * Recalculate a user's balance from the ledger and update the cache
 */
async function recalculateBalance(userId: string): Promise<number> {
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

/**
 * Get recent Stripe events
 */
export async function getStripeEvents(limit: number = 50): Promise<any[]> {
  try {
    const events = await prisma.stripeEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: limit
    });

    return events;
  } catch (error) {
    console.error('Error getting Stripe events:', error);
    throw error;
  }
}

/**
 * Record a Stripe event
 */
export async function recordStripeEvent(
  eventId: string,
  eventType: string,
  processed: boolean = false,
  error?: string
): Promise<void> {
  try {
    await prisma.stripeEvent.upsert({
      where: { eventId },
      update: {
        processedOk: processed,
        processedAt: processed ? new Date() : null,
        error: error
      },
      create: {
        eventId,
        type: eventType,
        processedOk: processed,
        processedAt: processed ? new Date() : null,
        error: error
      }
    });
  } catch (error) {
    console.error('Error recording Stripe event:', error);
    throw error;
  }
}

/**
 * Check if a Stripe event has already been processed
 */
export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  try {
    const event = await prisma.stripeEvent.findUnique({
      where: { eventId }
    });

    return !!event && !!event.processedOk;
  } catch (error) {
    console.error('Error checking Stripe event:', error);
    return false;
  }
}

/**
 * Initialize credits for a new user
 */
export async function initializeUserCredits(
  userId: string,
  initialCredits: number = 5
): Promise<number> {
  const options: CreditOperationOptions = {
    source: CreditsSource.MIGRATION,
    refType: 'user_initialization',
    refId: userId,
    idempotencyKey: `init_${userId}`,
    metadata: { note: 'Initial credits for new user' }
  };

  return addCredits(userId, initialCredits, options);
}

/**
 * Get credits debug information
 */
export async function getCreditsDebugInfo(userId: string): Promise<any> {
  try {
    const balance = await getBalance(userId);
    const ledgerEntries = await getLedgerEntries(userId, 20);
    const stripeEvents = await getStripeEvents(50);
    
    const isSubscriber = await prisma.subscription.findFirst({
      where: { 
        userId,
        status: { in: ['active', 'trialing'] }
      }
    });

    return {
      userId,
      balance,
      isSubscriber: !!isSubscriber,
      ledgerEntries,
      stripeEvents
    };
  } catch (error) {
    console.error('Error getting credits debug info:', error);
    throw error;
  }
}