/**
 * Single source of truth for AI feature availability
 * Simple boolean functions for checking AI service status
 */

// Environment-based feature flags
const ENABLE_GEMINI = process.env.ENABLE_GEMINI !== "false";
const ENABLE_VOICE = process.env.ENABLE_VOICE !== "false";
const ENABLE_RECEIPT_EXTRACTION = process.env.ENABLE_RECEIPT_EXTRACTION !== "false";

/**
 * Check if OpenAI is available and enabled
 */
export function isOpenAIEnabled() {
  return !!(
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY.trim() !== ""
  );
}

/**
 * Check if Gemini is available and enabled
 */
export function isGeminiEnabled() {
  if (!ENABLE_GEMINI) {
    return false;
  }

  return !!(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== ""
  );
}

/**
 * Check if voice processing is available
 * Voice can use either OpenAI or Gemini
 */
export function isVoiceEnabled() {
  if (!ENABLE_VOICE) {
    return false;
  }

  return isOpenAIEnabled() || isGeminiEnabled();
}

/**
 * Check if receipt extraction is available.
 * Now uses Gemini Vision (switched from OpenAI due to quota).
 * Falls back to OpenAI if Gemini is unavailable.
 */
export function isReceiptExtractionEnabled() {
  if (!ENABLE_RECEIPT_EXTRACTION) {
    return false;
  }

  // Prefer Gemini (free tier, no quota issues)
  return isGeminiEnabled() || isOpenAIEnabled();
}

