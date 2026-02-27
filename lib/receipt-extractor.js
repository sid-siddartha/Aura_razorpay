import { GoogleGenAI } from "@google/genai";

// Standardized extraction output shape
export const ReceiptExtractionResult = {
  amount: null,
  merchant: null,
  date: null,
  category: null,
  currency: null,
};

const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

const PROMPT = `Analyze this receipt/invoice image and extract transaction details.

IMPORTANT RULES:
1. Respond ONLY with valid JSON, no markdown, no code blocks, no explanations
2. Extract the exact values you see in the image
3. If a field cannot be determined, use null (not empty string, not 0)
4. Date must be in YYYY-MM-DD format if found, otherwise null
5. Amount must be a positive number (float) if found, otherwise null
6. Currency should be the 3-letter code (USD, EUR, INR, etc.) if visible, otherwise null

AVAILABLE CATEGORIES (pick the best match):
housing, transportation, groceries, utilities, entertainment, food, shopping, healthcare, education, personal, travel, insurance, gifts, bills, other-expense

REQUIRED JSON FORMAT (all fields must be present, use null if not found):
{"amount":<number or null>,"merchant":<string or null>,"date":<YYYY-MM-DD or null>,"category":<category or null>,"currency":<3-letter code or null>}

EXAMPLES:
- {"amount":45.99,"merchant":"Starbucks","date":"2025-01-15","category":"food","currency":"USD"}
- {"amount":null,"merchant":null,"date":null,"category":null,"currency":null}

Analyze the image now:`;

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini Vision with retry logic for 429 rate-limiting.
 * Tries each model in MODELS_TO_TRY, with up to 3 retries per model on 429.
 */
async function callGeminiVision(base64Image, mimeType) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  for (const modelName of MODELS_TO_TRY) {
    let retries = 3;
    let delayMs = 2000; // Start with 2s, double on each retry

    while (retries > 0) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Image,
                  },
                },
                { text: PROMPT },
              ],
            },
          ],
        });

        const text = response.text?.trim() ?? "";
        console.log(`[ReceiptExtractor] ✓ Model ${modelName} responded`);
        return text;
      } catch (error) {
        const is429 = error.status === 429 || error.message?.includes("429");
        const is404 = error.status === 404 || error.message?.includes("404");

        if (is404) {
          // Model not available — try next model immediately
          console.warn(`[ReceiptExtractor] Model ${modelName} not found, trying next...`);
          break;
        }

        if (is429 && retries > 1) {
          // Rate limited — wait then retry same model
          console.warn(
            `[ReceiptExtractor] 429 on ${modelName}, retrying in ${delayMs}ms... (${retries - 1} left)`
          );
          await sleep(delayMs);
          delayMs *= 2; // Exponential backoff
          retries--;
          continue;
        }

        // Non-retryable error or out of retries
        console.error(`[ReceiptExtractor] ${modelName} failed: ${error.message}`);
        break;
      }
    }
  }

  throw new Error("All Gemini models exhausted or rate-limited");
}

/**
 * Extract receipt data from an image file using Gemini Vision.
 * Returns standardized format: { amount, merchant, date, category, currency }
 */
export async function extractReceiptData(file) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[ReceiptExtractor] GEMINI_API_KEY not set");
    return ReceiptExtractionResult;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    console.log(
      `[ReceiptExtractor] Scanning: ${file.name} | ${mimeType} | ${(file.size / 1024).toFixed(1)}KB`
    );

    const rawText = await callGeminiVision(base64String, mimeType);
    console.log("[ReceiptExtractor] Raw response:", rawText.substring(0, 300));

    // Strip any accidental markdown code fences
    const cleaned = rawText.replace(/```(?:json)?\n?/g, "").trim();

    let extractedData;
    try {
      extractedData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[ReceiptExtractor] JSON parse failed:", parseErr.message, "| Raw:", cleaned);
      return ReceiptExtractionResult;
    }

    // Normalise
    const result = {
      amount:
        extractedData.amount != null ? parseFloat(extractedData.amount) : null,
      merchant: extractedData.merchant?.trim() || null,
      date: extractedData.date?.trim() || null,
      category: extractedData.category?.trim() || null,
      currency: extractedData.currency?.trim().toUpperCase() || null,
    };

    // Validate date format
    if (result.date && !/^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
      console.warn("[ReceiptExtractor] Invalid date format, clearing:", result.date);
      result.date = null;
    }

    // Validate amount
    if (result.amount !== null && (isNaN(result.amount) || result.amount < 0)) {
      console.warn("[ReceiptExtractor] Invalid amount, clearing:", result.amount);
      result.amount = null;
    }

    console.log("[ReceiptExtractor] Final result:", result);
    return result;
  } catch (error) {
    console.error("[ReceiptExtractor] Fatal error:", error.message);
    return ReceiptExtractionResult;
  }
}
