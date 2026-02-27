import { GoogleGenerativeAI } from "@google/generative-ai";

// Feature flag
const ENABLE_GEMINI = process.env.ENABLE_GEMINI !== "false";

// Valid Gemini models — listed in preference order.
// Use 'gemini-2.0-flash' as primary: fast, multimodal (vision), free tier.
// Fallback to 2.5-flash (higher quality) or lite (faster/cheaper).
// NOTE: gemini-1.5-* models are NOT available for this API key.
const VALID_MODELS = [
  { name: "gemini-2.0-flash", apiVersion: "v1beta" },
  { name: "gemini-2.5-flash", apiVersion: "v1beta" },
  { name: "gemini-2.0-flash-lite", apiVersion: "v1beta" },
  { name: "gemini-flash-latest", apiVersion: "v1beta" },
];

// Track quota errors to disable Gemini temporarily
let geminiQuotaExceeded = false;
let quotaErrorTimestamp = null;
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function isQuotaError(error) {
  if (!error) return false;
  const message = error.message || String(error);
  return (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("Quota exceeded") ||
    message.includes("rate limit")
  );
}

function isModelNotFoundError(error) {
  if (!error) return false;
  const message = error.message || String(error);
  return (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("not supported")
  );
}

export function isGeminiEnabled() {
  if (!ENABLE_GEMINI) {
    return false;
  }

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "") {
    return false;
  }

  // Check if we're in quota cooldown
  if (geminiQuotaExceeded && quotaErrorTimestamp) {
    const timeSinceError = Date.now() - quotaErrorTimestamp;
    if (timeSinceError < QUOTA_COOLDOWN_MS) {
      return false;
    }
    // Cooldown expired, reset
    geminiQuotaExceeded = false;
    quotaErrorTimestamp = null;
  }

  return true;
}

export function getGeminiModel() {
  if (!isGeminiEnabled()) {
    return null;
  }

  // Use env var if provided and valid
  const envModel = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME;
  if (envModel) {
    // Validate env model is in valid list
    const isValid = VALID_MODELS.some((m) => m.name === envModel);
    if (isValid) {
      const modelConfig = VALID_MODELS.find((m) => m.name === envModel);
      return modelConfig;
    }
    console.warn(`Invalid GEMINI_MODEL "${envModel}", using default`);
  }

  // Return first valid model as default
  return VALID_MODELS[0];
}

export async function callGeminiAPI(prompt, mediaData, mediaMimeType) {
  // Check availability (using the function directly, not the exported one to avoid circular dependency)
  if (!ENABLE_GEMINI || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "") {
    throw new Error("Gemini API is disabled or not configured");
  }

  // Try models in order until one works
  const modelsToTry = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME
    ? [{ name: process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME, apiVersion: "v1" }]
    : VALID_MODELS;

  let lastError = null;

  for (const modelConfig of modelsToTry) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      // Try with apiVersion option first
      let model;
      try {
        model = genAI.getGenerativeModel(
          { model: modelConfig.name },
          { apiVersion: modelConfig.apiVersion }
        );
      } catch (e) {
        // If that fails, try without apiVersion option
        model = genAI.getGenerativeModel({ model: modelConfig.name });
      }

      const parts = [prompt];
      if (mediaData && mediaMimeType) {
        parts.unshift({
          inlineData: {
            data: mediaData,
            mimeType: mediaMimeType,
          },
        });
      }

      const result = await model.generateContent(parts);
      const text = result.response.text().replace(/```(?:json)?\n?/g, "").trim();

      console.log(`✓ Gemini API call succeeded with model: ${modelConfig.name}`);
      return text;
    } catch (error) {
      lastError = error;

      // Handle quota errors - don't retry other models
      if (isQuotaError(error)) {
        geminiQuotaExceeded = true;
        quotaErrorTimestamp = Date.now();
        console.error("Gemini quota exceeded, disabling for 5 minutes");
        throw new Error(
          "Gemini API quota exceeded. Please try again later or check your billing."
        );
      }

      // For model not found, try next model
      if (isModelNotFoundError(error)) {
        console.warn(`Model "${modelConfig.name}" not found, trying next...`);
        continue;
      }

      // For other errors, try next model
      console.warn(`Model "${modelConfig.name}" failed: ${error.message}, trying next...`);
      continue;
    }
  }

  // All models failed
  console.error("All Gemini models failed. Last error:", lastError?.message);
  throw new Error(
    `Gemini API unavailable. All models failed. Last error: ${lastError?.message || "Unknown error"}`
  );
}

export function resetGeminiQuota() {
  geminiQuotaExceeded = false;
  quotaErrorTimestamp = null;
}

