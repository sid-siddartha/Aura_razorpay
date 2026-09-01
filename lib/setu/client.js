/**
 * lib/setu/client.js
 *
 * Server-side only Setu Account Aggregator service.
 * Never import this module in client components.
 *
 * Authentication: Bearer Token via Setu Bridge Auth API + x-product-instance-id.
 */

const BASE_URL = `${(process.env.SETU_BASE_URL || "https://fiu-sandbox.setu.co").replace(/\/+$/, "")}/v2`;
const AUTH_URL = "https://orgservice-prod.setu.co/v1/users/login";

// Cache token in-memory to avoid redundant logins
let cachedToken = null;
let tokenExpiryTime = 0;

/**
 * Fetch a Bearer access token from Setu's Auth service.
 */
async function getAccessToken() {
  const clientId = process.env.SETU_CLIENT_ID;
  const clientSecret = process.env.SETU_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Setu credentials are missing. Set SETU_CLIENT_ID and SETU_CLIENT_SECRET in your environment."
    );
  }

  const now = Date.now();
  // Return cached token if valid for at least 60 more seconds
  if (cachedToken && tokenExpiryTime > now + 60000) {
    return cachedToken;
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      client: "bridge",
    },
    body: JSON.stringify({
      clientID: clientId,
      grant_type: "client_credentials",
      secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Setu auth failed (HTTP ${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("No access_token returned by Setu auth service.");
  }

  cachedToken = data.access_token;
  // Default to 1 hour expiry if not specified
  tokenExpiryTime = now + 3600 * 1000;
  return cachedToken;
}

/**
 * Build headers for Setu FIU V2 API calls.
 */
async function getHeaders() {
  const productInstanceId = process.env.SETU_PRODUCT_INSTANCE_ID;
  if (!productInstanceId) {
    throw new Error(
      "SETU_PRODUCT_INSTANCE_ID is missing in your environment."
    );
  }

  const token = await getAccessToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-product-instance-id": productInstanceId,
  };
}

/**
 * Create a consent request on Setu.
 *
 * @param {string} mobileNumber - 10-digit Indian mobile number (no country code)
 * @param {string} redirectUrl  - URL Setu redirects to after consent flow completes
 * @returns {Promise<{ id: string, url: string, status: string }>}
 */
export async function createConsent(mobileNumber, redirectUrl) {
  const vua = mobileNumber;

  const now = new Date();

  // Fetch transaction data from 1 year ago to today
  const dataFrom = new Date(now);
  dataFrom.setFullYear(dataFrom.getFullYear() - 1);

  const payload = {
    consentDuration: {
      unit: "MONTH",
      value: "12",
    },
    vua,
    dataRange: {
      from: dataFrom.toISOString(),
      to: now.toISOString(),
    },
    dataLife: {
      unit: "INF",
      value: 0,
    },
    fetchType: "PERIODIC",
    frequency: {
      unit: "DAY",
      value: 1,
    },
    context: [],
    redirectUrl,
  };

  const endpoint = `${BASE_URL}/consents`;
  console.log("[Setu] POST", endpoint, "| vua:", vua, "| redirectUrl:", redirectUrl);

  const headers = await getHeaders();
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  console.log("[Setu] createConsent →", res.status, rawText);

  if (!res.ok) {
    let errorDetail = rawText;
    try {
      const errBody = JSON.parse(rawText);
      errorDetail = errBody.errorMsg || errBody.message || rawText;
    } catch {
      // rawText is already the error string
    }
    throw new Error(
      `Setu createConsent failed (HTTP ${res.status}): ${errorDetail}`
    );
  }

  const data = JSON.parse(rawText);
  return {
    id: data.id,
    url: data.url,
    status: data.status,
  };
}

/**
 * Fetch the current status of a consent request from Setu.
 *
 * @param {string} consentId - The Setu consent UUID
 * @returns {Promise<{ id: string, url: string, status: string, detail: object, accountsLinked: array }>}
 */
export async function getConsent(consentId) {
  const endpoint = `${BASE_URL}/consents/${consentId}?expanded=true`;
  console.log("[Setu] GET", endpoint);

  const headers = await getHeaders();
  const res = await fetch(endpoint, {
    method: "GET",
    headers,
  });

  const rawText = await res.text();
  console.log("[Setu] getConsent →", res.status, rawText);

  if (!res.ok) {
    let errorDetail = rawText;
    try {
      const errBody = JSON.parse(rawText);
      errorDetail = errBody.errorMsg || errBody.message || rawText;
    } catch {
      // rawText is already the error string
    }
    throw new Error(
      `Setu getConsent failed (HTTP ${res.status}): ${errorDetail}`
    );
  }

  return JSON.parse(rawText);
}

/**
 * Categorize a bank transaction narration into an Aura category id.
 */
function categorizeTransaction(narration = "", type = "EXPENSE", mode = "") {
  const n = (narration + " " + mode).toLowerCase();

  if (type === "INCOME") {
    if (n.includes("salary") || n.includes("payroll")) return "salary";
    if (n.includes("interest") || n.includes("dividend") || n.includes("mf") || n.includes("stock")) return "investments";
    if (n.includes("rent")) return "rental";
    if (n.includes("freelance") || n.includes("consult")) return "freelance";
    return "other-income";
  }

  // Expense categories
  if (n.includes("swiggy") || n.includes("zomato") || n.includes("restaurant") || n.includes("food") || n.includes("cafe") || n.includes("dine")) return "food";
  if (n.includes("blinkit") || n.includes("zepto") || n.includes("instamart") || n.includes("grocery") || n.includes("supermarket") || n.includes("mart")) return "groceries";
  if (n.includes("uber") || n.includes("ola") || n.includes("fuel") || n.includes("petrol") || n.includes("diesel") || n.includes("metro") || n.includes("railway") || n.includes("irctc")) return "transportation";
  if (n.includes("flight") || n.includes("airline") || n.includes("makemytrip") || n.includes("hotel") || n.includes("stay") || n.includes("travel")) return "travel";
  if (n.includes("amazon") || n.includes("flipkart") || n.includes("myntra") || n.includes("shopping") || n.includes("retail") || n.includes("store")) return "shopping";
  if (n.includes("electricity") || n.includes("water") || n.includes("gas") || n.includes("broadband") || n.includes("wifi") || n.includes("airtel") || n.includes("jio") || n.includes("recharge")) return "utilities";
  if (n.includes("netflix") || n.includes("spotify") || n.includes("prime") || n.includes("hotstar") || n.includes("movie") || n.includes("cinema") || n.includes("pvr")) return "entertainment";
  if (n.includes("hospital") || n.includes("pharmacy") || n.includes("medical") || n.includes("clinic") || n.includes("1mg") || n.includes("apollo") || n.includes("health")) return "healthcare";
  if (n.includes("fee") || n.includes("charge") || n.includes("tax") || n.includes("penalty")) return "bills";
  if (n.includes("insurance") || n.includes("lic") || n.includes("premium")) return "insurance";
  if (n.includes("rent") || n.includes("maintenance") || n.includes("society")) return "housing";

  return "other-expense";
}

import { db } from "../prisma.js";

/**
 * Fetch Financial Information (FI) from Setu for an approved consent,
 * and synchronize accounts & 3 months of bank transactions to Prisma DB.
 *
 * @param {string} consentId - Setu consent UUID
 * @param {string} userId    - Internal User database ID
 */
export async function fetchAndSyncTransactions(consentId, userId) {


  console.log(`[AA Sync] Starting bank sync for consent ${consentId}, user ${userId}`);

  // 1. Fetch consent details
  const consent = await getConsent(consentId);
  if (!consent || (consent.status !== "ACTIVE" && consent.status !== "APPROVED" && consent.status !== "PENDING")) {
    console.warn(`[AA Sync] Consent ${consentId} is not in an active state: ${consent?.status}`);
  }

  // 2. Determine data range from consent
  const dataFrom = consent?.detail?.dataRange?.from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const dataTo = consent?.detail?.dataRange?.to || new Date().toISOString();

  // 3. Create FI data fetch session
  const headers = await getHeaders();
  const sessionRes = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      consentId,
      dataRange: {
        from: dataFrom,
        to: dataTo,
      },
      format: "json",
    }),
  });

  if (!sessionRes.ok) {
    const errText = await sessionRes.text();
    console.error(`[AA Sync] Failed to create FI session: ${errText}`);
    
    // If consent use was already consumed or completed, still ensure connection is marked CONNECTED
    if (errText.includes("Consent use exceeded") || errText.includes("already")) {
      await db.accountAggregatorConnection.updateMany({
        where: { userId },
        data: { status: "CONNECTED", vua: consent.detail?.vua || undefined },
      });
      return { success: true, message: "Consent already used / active" };
    }
    
    throw new Error(`FI session creation failed: ${errText}`);
  }

  const session = await sessionRes.json();
  const sessionId = session.id;
  console.log(`[AA Sync] FI session created: ${sessionId}`);

  // 4. Poll for FI Data completion
  let fiData = null;
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const getDataRes = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      method: "GET",
      headers,
    });

    if (getDataRes.ok) {
      const data = await getDataRes.json();
      if (data.status === "COMPLETED" || data.status === "READY" || data.payload || data.Payload) {
        fiData = data;
        break;
      }
    }
  }

  if (!fiData) {
    console.warn(`[AA Sync] FI Data fetch timed out for session ${sessionId}`);
    return { success: false, reason: "FI data not ready" };
  }

  console.log(`[AA Sync] FI Data received successfully`);

  // 5. Parse Linked Accounts and Transactions
  const payloadArray = fiData.payload || fiData.Payload || [];
  let totalAccountsSynced = 0;
  let totalTransactionsSynced = 0;

  // Calculate 3 months cutoff date
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (const fipGroup of payloadArray) {
    const accounts = fipGroup.data || fipGroup.Data || [];

    for (const accData of accounts) {
      const decData = accData.decData || accData.DecData || {};
      const accountSummary = decData.account?.summary || decData.account?.Summary || {};
      const accountProfile = decData.account?.profile || decData.account?.Profile || {};
      const maskedAccNumber = decData.account?.maskedAccNumber || accData.maskedAccNumber || "XXXX";
      const accType = (decData.account?.type || accData.accType || "SAVINGS").toUpperCase() === "CURRENT" ? "CURRENT" : "SAVINGS";
      const fipId = (accData.fipId || fipGroup.fipId || "Bank").toUpperCase();
      const currentBalance = parseFloat(accountSummary.currentBalance || accountSummary.balance || 0);

      const accountName = `${fipId} (${accType} ••${maskedAccNumber.slice(-4)})`;

      // Check if this account already exists in DB for this user
      let account = await db.account.findFirst({
        where: {
          userId,
          name: accountName,
        },
      });

      // Check if user has any existing accounts (to set isDefault)
      const userAccountsCount = await db.account.count({ where: { userId } });

      if (!account) {
        account = await db.account.create({
          data: {
            name: accountName,
            type: accType,
            balance: isNaN(currentBalance) ? 0 : currentBalance,
            isDefault: userAccountsCount === 0,
            userId,
          },
        });
        console.log(`[AA Sync] Created new account: ${account.name} (ID: ${account.id})`);
      } else {
        // Update balance
        if (!isNaN(currentBalance)) {
          await db.account.update({
            where: { id: account.id },
            data: { balance: currentBalance },
          });
        }
      }

      totalAccountsSynced++;

      // Process Transactions
      const txnsList = decData.account?.transactions?.transaction || decData.account?.Transactions?.Transaction || [];
      console.log(`[AA Sync] Found ${txnsList.length} transactions in statement for ${accountName}`);

      for (const txn of txnsList) {
        const txnDate = new Date(txn.transactionTimestamp || txn.valueDate || Date.now());

        // Filter for last 3 months
        if (txnDate < threeMonthsAgo) {
          continue;
        }

        const amount = Math.abs(parseFloat(txn.amount || 0));
        if (isNaN(amount) || amount === 0) continue;

        const isIncome = (txn.type || "").toUpperCase() === "CREDIT";
        const txnType = isIncome ? "INCOME" : "EXPENSE";
        const narration = txn.narration || txn.description || `${txn.mode || "Bank"} Transaction`;
        const category = categorizeTransaction(narration, txnType, txn.mode);

        // Check for existing transaction to avoid duplication
        const existingTxn = await db.transaction.findFirst({
          where: {
            accountId: account.id,
            userId,
            amount,
            date: txnDate,
            description: narration,
          },
        });

        if (!existingTxn) {
          await db.transaction.create({
            data: {
              type: txnType,
              amount,
              description: narration,
              date: txnDate,
              category,
              status: "COMPLETED",
              userId,
              accountId: account.id,
            },
          });
          totalTransactionsSynced++;
        }
      }
    }
  }

  // 6. Update AA Connection status in DB to CONNECTED
  await db.accountAggregatorConnection.updateMany({
    where: { userId },
    data: {
      status: "CONNECTED",
      vua: consent.detail?.vua || undefined,
    },
  });

  console.log(`[AA Sync] Completed! Synced ${totalAccountsSynced} accounts, ${totalTransactionsSynced} transactions.`);
  return {
    success: true,
    accountsSynced: totalAccountsSynced,
    transactionsSynced: totalTransactionsSynced,
  };
}
