"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { withRateLimit } from "@/lib/arcjet";
import { extractReceiptData } from "@/lib/receipt-extractor";
import { processVoiceAudio } from "@/lib/voice-processor";

const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});

// Create Transaction
export async function createTransaction(data) {
  return withRateLimit("transactionCreate", async () => {
    try {
      console.log("createTransaction called with data:", JSON.stringify(data));

      const { userId } = await auth();
    console.log("Clerk userId:", userId);

    if (!userId) {
      console.error("No userId from Clerk");
      return { success: false, error: "Unauthorized - please sign in" };
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    console.log("User found:", user?.id);

    if (!user) {
      console.error("User not found for clerkUserId:", userId);
      return { success: false, error: "User not found in database" };
    }

    // Validate required fields
    if (
      !data.amount ||
      !data.accountId ||
      !data.category ||
      !data.date ||
      !data.type
    ) {
      console.error("Missing required fields:", {
        amount: data.amount,
        accountId: data.accountId,
        category: data.category,
        date: data.date,
        type: data.type,
      });
      return {
        success: false,
        error:
          "Missing required fields: amount, accountId, category, date, type",
      };
    }

    console.log(
      "All required fields present, finding account:",
      data.accountId
    );

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });
    console.log(
      "Account found:",
      account?.id,
      "balance:",
      account?.balance.toString()
    );

    if (!account) {
      console.error("Account not found or doesn't belong to user");
      return {
        success: false,
        error: "Account not found or does not belong to user",
      };
    }

    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const newBalance = account.balance.toNumber() + balanceChange;
    console.log("Balance change:", balanceChange, "new balance:", newBalance);

    const transaction = await db.$transaction(async (tx) => {
      console.log("Creating transaction...");
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });
      console.log("Transaction created:", newTransaction.id);

      console.log("Updating account balance...");
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: newBalance },
      });
      console.log("Account balance updated");

      return newTransaction;
    });

    console.log("Revalidating paths...");
    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

      console.log("Transaction creation successful, returning:", transaction.id);
      return { success: true, data: serializeAmount(transaction) };
    } catch (error) {
      console.error("createTransaction error:", error);
      return {
        success: false,
        error: error.message || "Failed to create transaction. Please try again.",
      };
    }
  });
}

export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
    where: { id, userId: user.id },
  });
  if (!transaction) throw new Error("Transaction not found");

  return serializeAmount(transaction);
}

export async function updateTransaction(id, data) {
  return withRateLimit("transactionCreate", async () => {
    try {
      const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized - please sign in" };
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) {
      return { success: false, error: "User not found in database" };
    }

    const original = await db.transaction.findUnique({
      where: { id, userId: user.id },
      include: { account: true },
    });

    if (!original) {
      return { success: false, error: "Transaction not found" };
    }

    const oldChange =
      original.type === "EXPENSE"
        ? -original.amount.toNumber()
        : original.amount.toNumber();

    const newChange = data.type === "EXPENSE" ? -data.amount : data.amount;

    const netChange = newChange - oldChange;

    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id, userId: user.id },
        data: {
          ...data,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: { increment: netChange },
        },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

      return { success: true, data: serializeAmount(transaction) };
    } catch (error) {
      console.error("updateTransaction error:", error);
      return {
        success: false,
        error: error.message || "Failed to update transaction. Please try again.",
      };
    }
  });
}

// Get User Transactions
export async function getUserTransactions(query = {}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const transactions = await db.transaction.findMany({
      where: { userId: user.id, ...query },
      include: { account: true },
      orderBy: { date: "desc" },
    });

    return { success: true, data: transactions };
  } catch (error) {
    console.error("getUserTransactions error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch transactions",
    };
  }
}

// Scan Receipt
export async function scanReceipt(file) {
  return withRateLimit("aiOperations", async () => {
    try {
      // Extract receipt data using OpenAI Vision
      const extracted = await extractReceiptData(file);

      // Convert standardized format to form-compatible format
      const result = {
        amount: extracted.amount ?? 0,
        date: extracted.date ? new Date(extracted.date) : new Date(),
        description: extracted.merchant 
          ? `${extracted.merchant}${extracted.currency ? ` (${extracted.currency})` : ""}`
          : "Receipt transaction",
        merchantName: extracted.merchant ?? "",
        category: extracted.category ?? "other-expense",
        currency: extracted.currency ?? null,
      };

      // If no data was extracted, still return structure so form can be used
      if (extracted.amount === null && !extracted.merchant && !extracted.date) {
        console.warn("No receipt data extracted from image");
        result.description = "No receipt data detected - please enter details manually";
        result._fallback = true;
      }

      console.log("Receipt scan result:", result);
      return result;
    } catch (error) {
      console.error("Receipt scan error:", error.message);
      // Return structure with today's date so form can still be used
      return {
        amount: 0,
        date: new Date(),
        description: `Receipt scan failed: ${error.message}. Please enter details manually.`,
        merchantName: "",
        category: "other-expense",
        _fallback: true,
      };
    }
  });
}

// -------------------------------
// Voice Transaction (TEXT ONLY - client-side STT)
export async function processVoiceText(transcript) {
  return withRateLimit("aiOperations", async () => {
    try {
      if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
        console.warn("Empty transcript received");
        return {
          amount: 0,
          date: new Date(),
          description: "",
          merchantName: "",
          category: "other-expense",
          _source: "voice",
        };
      }

      // Parse transcript using local parser (no AI needed)
      const { parseLocalVoice } = await import("@/lib/localVoiceParser");
      const parsed = parseLocalVoice(transcript.trim());
      
      console.log("Parsed voice text:", parsed);

      // Convert to form-compatible format
      const result = {
        amount: parsed.amount ?? 0,
        date: parsed.date ? new Date(parsed.date) : new Date(),
        description: parsed.description || "",
        merchantName: parsed.merchantName || "",
        category: parsed.category || "other-expense",
        _source: parsed._source || "voice",
      };

      console.log("Voice transaction result:", result);
      return result;
    } catch (error) {
      console.error("Voice text processing error:", error.message);
      // NEVER return error messages in form data
      // Return structure with today's date - user can enter manually
      return {
        amount: 0,
        date: new Date(),
        description: "",
        merchantName: "",
        category: "other-expense",
        _source: "voice",
      };
    }
  });
}

// Legacy function - kept for backward compatibility but deprecated
export async function processVoiceTransaction(audioFile) {
  console.warn("processVoiceTransaction(audioFile) is deprecated. Use processVoiceText(text) instead.");
  // Return empty structure - encourage using text-based approach
  return {
    amount: 0,
    date: new Date(),
    description: "",
    merchantName: "",
    category: "other-expense",
    _source: "voice",
    _deprecated: true,
  };
}

// Helper: Process date string from Gemini (handles relative dates like TODAY_IST, YESTERDAY_IST)
function processDateString(dateStr) {
  if (!dateStr) return new Date();
  
  const dateStrUpper = String(dateStr).toUpperCase().trim();
  
  // Handle relative dates
  if (dateStrUpper === "TODAY_IST" || dateStrUpper === "TODAY") {
    return new Date();
  }
  
  if (dateStrUpper === "YESTERDAY_IST" || dateStrUpper === "YESTERDAY") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  if (dateStrUpper === "TOMORROW_IST" || dateStrUpper === "TOMORROW") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  // Try to parse as regular date (YYYY-MM-DD or ISO format)
  try {
    const parsedDate = new Date(dateStr);
    // Validate that it's a valid date
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  } catch (e) {
    console.warn("Failed to parse date:", dateStr);
  }
  
  // Default to today if parsing fails
  return new Date();
}

// Helper: Recurring Date
function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}