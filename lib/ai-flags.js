/**
 * Centralized AI feature flags
 * Single source of truth for all AI feature availability
 */

// Environment-based feature flags
const ENABLE_GEMINI = process.env.ENABLE_GEMINI !== "false";
const ENABLE_VOICE = process.env.ENABLE_VOICE !== "false";
const ENABLE_RECEIPT_EXTRACTION = process.env.ENABLE_RECEIPT_EXTRACTION !== "false";

// Check if Gemini is available
function checkGeminiAvailability() {
  if (!ENABLE_GEMINI) {
    return { available: false, reason: "Gemini disabled via ENABLE_GEMINI flag" };
  }

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "") {
    return { available: false, reason: "GEMINI_API_KEY not set" };
  }

  return { available: true, reason: null };
}

// Check if OpenAI is available
function checkOpenAIAvailability() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === "") {
    return { available: false, reason: "OPENAI_API_KEY not set" };
  }

  return { available: true, reason: null };
}

// Check if voice processing is available
function checkVoiceAvailability() {
  if (!ENABLE_VOICE) {
    return { available: false, reason: "Voice disabled via ENABLE_VOICE flag" };
  }

  // Voice can use either Gemini or OpenAI
  const gemini = checkGeminiAvailability();
  const openai = checkOpenAIAvailability();

  if (gemini.available || openai.available) {
    return { 
      available: true, 
      reason: null,
      provider: gemini.available ? "gemini" : "openai"
    };
  }

  return { 
    available: false, 
    reason: "No AI provider available (need GEMINI_API_KEY or OPENAI_API_KEY)" 
  };
}

// Export feature flags object
export const AI_FLAGS = {
  get GEMINI_ENABLED() {
    return checkGeminiAvailability().available;
  },
  get VOICE_ENABLED() {
    return checkVoiceAvailability().available;
  },
  get RECEIPT_EXTRACTION_ENABLED() {
    if (!ENABLE_RECEIPT_EXTRACTION) {
      return false;
    }
    return checkOpenAIAvailability().available;
  },
};

// Export detailed availability checks
export function getGeminiStatus() {
  return checkGeminiAvailability();
}

export function getOpenAIStatus() {
  return checkOpenAIAvailability();
}

export function getVoiceStatus() {
  return checkVoiceAvailability();
}

