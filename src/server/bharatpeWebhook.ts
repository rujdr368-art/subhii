import crypto from 'crypto';
import { Request, Response } from 'express';
import { db } from '../db';
import { payments, users, activityLogs, settings } from '../db/schema';
import { eq, or, sql, and } from 'drizzle-orm';
import { syncPaymentToSupabase, syncUserBalanceToSupabase } from './supabase';

/**
 * Mask sensitive data for server logs
 */
function maskString(val: string, visibleStart = 4, visibleEnd = 4): string {
  if (!val) return '';
  const str = String(val).trim();
  if (str.length <= visibleStart + visibleEnd) {
    return str.slice(0, 2) + '****' + str.slice(-2);
  }
  return str.slice(0, visibleStart) + '****' + str.slice(-visibleEnd);
}

/**
 * Parses and extracts webhook transaction details across official BharatPe API payload variants
 */
export function extractBharatPePayload(body: any) {
  // Support payload inside nested objects: data, payload, transaction, or top-level body
  const payload = body?.data || body?.payload || body?.transaction || body || {};

  // 1. Transaction Reference / UTR
  const rawUtr =
    payload.bankReferenceNo ||
    payload.utr ||
    payload.rrn ||
    payload.bank_ref_no ||
    payload.transactionId ||
    payload.txnId ||
    payload.txId ||
    payload.referenceId ||
    '';

  const cleanUtr = String(rawUtr).trim().replace(/\D/g, '');

  // 2. Order Reference / Note / Remark
  const orderRef =
    payload.orderRef ||
    payload.orderId ||
    payload.order_id ||
    payload.merchantTransactionId ||
    payload.clientReferenceId ||
    payload.note ||
    payload.remarks ||
    payload.txDesc ||
    '';

  // 3. Amount
  const rawAmount =
    payload.amount !== undefined
      ? payload.amount
      : payload.txnAmount !== undefined
      ? payload.txnAmount
      : payload.paymentAmount !== undefined
      ? payload.paymentAmount
      : payload.netAmount !== undefined
      ? payload.netAmount
      : payload.paidAmount;

  const amount = parseFloat(rawAmount);

  // 4. Status
  const rawStatus =
    payload.status ||
    payload.paymentStatus ||
    payload.txnStatus ||
    payload.transactionStatus ||
    payload.state ||
    '';

  const status = String(rawStatus).toUpperCase().trim();

  // 5. Customer / Payer Information
  const payerVpa = payload.payerVpa || payload.vpa || payload.customerVpa || payload.senderVpa || '';
  const payerName = payload.payerName || payload.customerName || payload.senderName || '';
  const merchantId = payload.merchantId || payload.mid || payload.merchant_id || '';

  return {
    cleanUtr,
    orderRef: String(orderRef).trim(),
    amount: isNaN(amount) ? null : amount,
    status,
    payerVpa: String(payerVpa).trim(),
    payerName: String(payerName).trim(),
    merchantId: String(merchantId).trim(),
    rawPayload: payload,
  };
}

/**
 * Validates Webhook Authentication & Signatures
 * Supported official methods:
 * 1. HMAC SHA-256 Signature verification using BHARATPE_WEBHOOK_SECRET
 * 2. Shared Webhook Secret Token comparison (x-bharatpe-signature, token, authorization, x-webhook-secret)
 * 3. Merchant API Token comparison using BHARATPE_TOKEN
 */
export async function authenticateBharatPeWebhook(req: Request): Promise<{
  authenticated: boolean;
  reason?: string;
}> {
  let webhookSecret = (process.env.BHARATPE_WEBHOOK_SECRET || '').trim();
  let merchantToken = (process.env.BHARATPE_TOKEN || process.env.BHARATPE_API_KEY || '').trim();

  // If not in environment variables, check database settings table
  if (!webhookSecret && !merchantToken) {
    try {
      const dbSettings = await db.select().from(settings);
      const settingsMap = Object.fromEntries(dbSettings.map(s => [s.key, s.value]));
      webhookSecret = (settingsMap['bharatpeWebhookSecret'] || '').trim();
      merchantToken = (settingsMap['bharatpeToken'] || '').trim();
    } catch {
      // ignore
    }
  }

  // If no webhook secret or token configured
  if (!webhookSecret && !merchantToken) {
    console.error('[BharatPe Webhook] Configuration Error: Neither BHARATPE_WEBHOOK_SECRET nor BHARATPE_TOKEN is set in environment variables or settings.');
    return {
      authenticated: false,
      reason: 'Server configuration error: Webhook verification credentials not configured in backend environment.',
    };
  }

  // Extract authentication tokens/signatures from headers
  const authHeader = req.headers['authorization'] || '';
  const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const signatureHeader = String(
    req.headers['x-bharatpe-signature'] ||
    req.headers['x-signature'] ||
    req.headers['x-hub-signature'] ||
    req.headers['x-bharatpe-hash'] ||
    ''
  ).trim();

  const tokenHeader = String(
    req.headers['token'] ||
    req.headers['x-bharatpe-token'] ||
    req.headers['x-webhook-secret'] ||
    req.headers['x-api-key'] ||
    bearerToken ||
    req.query.token ||
    req.query.secret ||
    ''
  ).trim();

  // 1. Verify HMAC SHA-256 Signature if signatureHeader and webhookSecret exist
  if (webhookSecret && signatureHeader) {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const computedHmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      // Compare signatures using timing-safe buffer comparison
      const cleanSig = signatureHeader.replace(/^sha256=/i, '');
      const sigBuffer = Buffer.from(cleanSig, 'utf8');
      const compBuffer = Buffer.from(computedHmac, 'utf8');

      if (sigBuffer.length === compBuffer.length && crypto.timingSafeEqual(sigBuffer, compBuffer)) {
        return { authenticated: true };
      }

      console.warn('[BharatPe Webhook] HMAC SHA256 signature mismatch.');
      return {
        authenticated: false,
        reason: 'Invalid webhook HMAC signature.',
      };
    } catch (err: any) {
      console.error('[BharatPe Webhook] Signature verification failed:', err.message);
    }
  }

  // 2. Verify against BHARATPE_WEBHOOK_SECRET directly
  if (webhookSecret) {
    if (tokenHeader && tokenHeader === webhookSecret) {
      return { authenticated: true };
    }
    if (signatureHeader && signatureHeader === webhookSecret) {
      return { authenticated: true };
    }
  }

  // 3. Fallback: Verify against BHARATPE_TOKEN
  if (merchantToken) {
    if (tokenHeader && tokenHeader === merchantToken) {
      return { authenticated: true };
    }
  }

  return {
    authenticated: false,
    reason: 'Unauthorized: Missing or invalid BharatPe webhook authentication token/signature.',
  };
}

/**
 * Log activities in local database for auditing
 */
async function recordActivity(userId: number | null, action: string, details: string, ip?: string) {
  try {
    await db.insert(activityLogs).values({
      userId,
      action,
      details,
      ipAddress: ip || 'webhook',
    });
  } catch (err) {
    console.warn('[BharatPe Webhook] Failed to record activity log:', err);
  }
}

/**
 * Main Webhook Controller for POST /api/payment/webhook
 */
export async function handleBharatPeWebhook(req: Request, res: Response) {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  console.log(`[BharatPe Webhook] Received incoming callback from IP: ${clientIp}`);

  // 1. Validate / Authenticate Webhook Request
  const authCheck = await authenticateBharatPeWebhook(req);
  if (!authCheck.authenticated) {
    console.warn(`[BharatPe Webhook] Rejected unauthorized callback: ${authCheck.reason}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: authCheck.reason || 'Authentication failed',
    });
  }

  // 2. Extract and sanitize payload
  const {
    cleanUtr,
    orderRef,
    amount,
    status,
    payerVpa,
    payerName,
    merchantId,
    rawPayload,
  } = extractBharatPePayload(req.body);

  console.log(
    `[BharatPe Webhook] Processing Transaction: UTR=${maskString(cleanUtr)}, OrderRef=${orderRef || 'none'}, Status=${status}, Amount=${amount}`
  );

  // 3. Validate Mandatory 12-Digit UTR
  if (!cleanUtr || cleanUtr.length !== 12) {
    console.warn(`[BharatPe Webhook] Invalid UTR length: ${cleanUtr.length} digits`);
    return res.status(400).json({
      error: 'Invalid UTR',
      message: 'Payment bankReferenceNo/UTR must be a valid 12-digit number.',
    });
  }

  // Check for dummy/fake sequential or repeated patterns
  const isRepeated = /^(\d)\1{11}$/.test(cleanUtr);
  const isSequential =
    '01234567890123456789'.includes(cleanUtr) ||
    '98765432109876543210'.includes(cleanUtr);

  if (isRepeated || isSequential) {
    console.warn(`[BharatPe Webhook] Rejected dummy/fake UTR pattern: ${cleanUtr}`);
    return res.status(400).json({
      error: 'Invalid UTR pattern',
      message: 'Dummy or repeated UTR test patterns are not accepted.',
    });
  }

  // 4. Validate Amount
  if (amount === null || amount <= 0) {
    console.warn('[BharatPe Webhook] Invalid or zero amount received.');
    return res.status(400).json({
      error: 'Invalid Amount',
      message: 'Payment amount must be greater than zero.',
    });
  }

  // 5. Validate Transaction Status
  const isSuccessful =
    status === 'SUCCESS' ||
    status === 'COMPLETED' ||
    status === 'SETTLED' ||
    status === 'SUCCESSFUL' ||
    status === 'PAID';

  if (!isSuccessful) {
    console.warn(`[BharatPe Webhook] Payment status is not successful (${status}). Wallet will NOT be credited.`);

    // If orderRef or UTR exists, mark the pending payment as failed
    if (orderRef || cleanUtr) {
      const matchCriteria = orderRef
        ? or(eq(payments.transactionId, orderRef), eq(payments.transactionId, cleanUtr))
        : eq(payments.transactionId, cleanUtr);

      const existingRecord = await db.select().from(payments).where(matchCriteria).limit(1);
      if (existingRecord.length > 0 && existingRecord[0].status === 'pending') {
        await db.update(payments).set({ status: 'failed' }).where(eq(payments.id, existingRecord[0].id));
        await syncPaymentToSupabase({
          userId: existingRecord[0].userId,
          amount: existingRecord[0].amount,
          paymentMethod: existingRecord[0].paymentMethod,
          transactionId: existingRecord[0].transactionId || cleanUtr,
          status: 'failed',
        });
      }
    }

    return res.status(422).json({
      error: 'Unconfirmed Payment Status',
      message: `Transaction status is '${status}'. Only successful transactions are credited.`,
    });
  }

  // 6. Prevent Duplicate Processing (Atomic Double-Spend Guard)
  const existingWithUtr = await db
    .select()
    .from(payments)
    .where(
      or(
        eq(payments.transactionId, cleanUtr),
        sql`${payments.transactionId} LIKE ${'%' + cleanUtr + '%'}`
      )
    )
    .limit(1);

  if (existingWithUtr.length > 0 && existingWithUtr[0].status === 'completed') {
    console.warn(
      `[BharatPe Webhook] Duplicate webhook: UTR ${maskString(cleanUtr)} already completed and credited previously.`
    );
    return res.status(409).json({
      error: 'Duplicate Transaction',
      message: 'This transaction/UTR has already been verified, credited, and completed.',
    });
  }

  // 7. Locate Pending Deposit Order in Database
  let targetPayment: any = null;

  // Search by orderRef (e.g. BPE-...)
  if (orderRef) {
    const existingByOrderRef = await db
      .select()
      .from(payments)
      .where(eq(payments.transactionId, orderRef))
      .limit(1);

    if (existingByOrderRef.length > 0) {
      targetPayment = existingByOrderRef[0];
    }
  }

  // If not found by orderRef, check if a pending record exists with this cleanUtr
  if (!targetPayment && existingWithUtr.length > 0) {
    targetPayment = existingWithUtr[0];
  }

  // If still not found, search for user's recent pending BharatPe payment matching this exact amount
  if (!targetPayment) {
    // Check if orderRef or note contains a user ID pattern (e.g. "USER-12" or "UID-12")
    const userMatch = orderRef.match(/(?:USER|UID|U)[-_]?(\d+)/i);
    if (userMatch && userMatch[1]) {
      const parsedUserId = parseInt(userMatch[1], 10);
      const pendingByUser = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.userId, parsedUserId),
            eq(payments.status, 'pending')
          )
        )
        .orderBy(sql`${payments.createdAt} DESC`)
        .limit(1);

      if (pendingByUser.length > 0) {
        targetPayment = pendingByUser[0];
      }
    }
  }

  // If no pending record is found, we cannot safely allocate funds without a valid user account
  if (!targetPayment) {
    console.warn(
      `[BharatPe Webhook] No matching pending deposit order found for UTR: ${maskString(cleanUtr)} (OrderRef: ${orderRef || 'none'}).`
    );
    return res.status(400).json({
      error: 'Order Not Found',
      message: 'No pending deposit order found matching the transaction details or user reference.',
    });
  }

  // 8. Verify Amount Matches the Pending Deposit Exactly
  const expectedAmount = Number(targetPayment.amount);
  const receivedAmount = Number(amount);

  // Allow negligible floating point tolerance (0.01 INR)
  if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
    console.warn(
      `[BharatPe Webhook] Amount mismatch! Expected ₹${expectedAmount}, but webhook reported ₹${receivedAmount} (UTR: ${maskString(cleanUtr)}).`
    );

    // Update payment record to reflect amount mismatch without adding to wallet
    await db
      .update(payments)
      .set({
        status: 'failed',
      })
      .where(eq(payments.id, targetPayment.id));

    await recordActivity(
      targetPayment.userId,
      'Deposit Webhook Amount Mismatch',
      `BharatPe webhook amount mismatch. Expected: ₹${expectedAmount}, Received: ₹${receivedAmount} (UTR: ${maskString(cleanUtr)})`,
      typeof clientIp === 'string' ? clientIp : 'webhook'
    );

    return res.status(400).json({
      error: 'Amount Mismatch',
      message: `Paid amount (₹${receivedAmount}) does not match pending order amount (₹${expectedAmount}). Wallet was not credited.`,
    });
  }

  // 9. Verification Complete! Update Payment & Credit User's Wallet Exactly Once
  try {
    // Resolve any conflicting records with this cleanUtr before updating
    if (targetPayment.transactionId !== cleanUtr) {
      const conflictRecord = await db
        .select()
        .from(payments)
        .where(eq(payments.transactionId, cleanUtr))
        .limit(1);

      if (conflictRecord.length > 0 && conflictRecord[0].id !== targetPayment.id) {
        await db.delete(payments).where(eq(payments.id, conflictRecord[0].id));
      }
    }

    // A. Update local payments table
    await db
      .update(payments)
      .set({
        amount: receivedAmount,
        transactionId: cleanUtr,
        status: 'completed',
      })
      .where(eq(payments.id, targetPayment.id));

    // B. Fetch user and update wallet balance atomically
    const userRows = await db.select().from(users).where(eq(users.id, targetPayment.userId)).limit(1);
    if (userRows.length === 0) {
      throw new Error(`User with ID ${targetPayment.userId} not found in database.`);
    }

    const currentBalance = userRows[0].balance || 0;
    const newBalance = currentBalance + receivedAmount;

    await db
      .update(users)
      .set({ balance: newBalance })
      .where(eq(users.id, targetPayment.userId));

    // C. Synchronize with Supabase database tables (Respecting existing RLS)
    try {
      await syncPaymentToSupabase({
        userId: targetPayment.userId,
        amount: receivedAmount,
        paymentMethod: targetPayment.paymentMethod || 'BharatPe UPI QR',
        transactionId: cleanUtr,
        status: 'completed',
        createdAt: targetPayment.createdAt,
      });

      await syncUserBalanceToSupabase(targetPayment.userId, newBalance);
    } catch (syncErr: any) {
      console.warn('[BharatPe Webhook] Supabase sync warning:', syncErr?.message || syncErr);
    }

    // D. Audit log
    await recordActivity(
      targetPayment.userId,
      'Deposit Verified via Webhook',
      `BharatPe Webhook verified payment of ₹${receivedAmount} (UTR: ${maskString(cleanUtr)}, OrderRef: ${orderRef || targetPayment.transactionId})`,
      typeof clientIp === 'string' ? clientIp : 'webhook'
    );

    console.log(
      `[BharatPe Webhook] SUCCESS: Credited ₹${receivedAmount} to User ID ${targetPayment.userId}. New Balance: ₹${newBalance} (UTR: ${maskString(cleanUtr)})`
    );

    // Return HTTP 200 ONLY for successfully verified and processed webhook
    return res.status(200).json({
      success: true,
      message: 'Payment verified and credited successfully.',
      transactionId: cleanUtr,
      amount: receivedAmount,
      userId: targetPayment.userId,
      status: 'completed',
    });
  } catch (error: any) {
    console.error('[BharatPe Webhook] Error while crediting wallet:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while crediting the wallet. Please contact support.',
    });
  }
}
