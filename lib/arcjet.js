import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";

// Feature flag
const ENABLE_ARCJET = process.env.ENABLE_ARCJET !== "false";

// Lazy initialization to prevent build-time evaluation
let arcjetModule = null;
let aj = null;

function initializeArcjet() {
  // Only initialize on server-side
  if (typeof window !== "undefined") {
    return null;
  }

  if (aj !== null) {
    return aj;
  }

  if (!ENABLE_ARCJET) {
    aj = createNoOpInstance();
    return aj;
  }

  if (!process.env.ARCJET_KEY || process.env.ARCJET_KEY.trim() === "") {
    console.warn("ARCJET_KEY not set - rate limiting disabled");
    aj = createNoOpInstance();
    return aj;
  }

  try {
    // Dynamic import to prevent build-time evaluation
    if (!arcjetModule) {
      arcjetModule = require("@arcjet/next");
    }

    const { default: arcjet, fixedWindow, tokenBucket } = arcjetModule;
    
    aj = arcjet({
      key: process.env.ARCJET_KEY,
    });

    return aj;
  } catch (error) {
    console.error("Failed to initialize Arcjet:", error.message);
    aj = createNoOpInstance();
    return aj;
  }
}

function createNoOpInstance() {
  return {
    protect: (config) => {
      // Return a function that can be called directly (Arcjet API)
      return async (request, options) => ({
        isDenied: () => false,
        reason: {
          isRateLimit: () => false,
          isBot: () => false,
          retryAfter: 0,
        },
      });
    },
  };
}

// Rate limiting configuration - lazy loaded
let rateLimitCache = null;

function getRateLimit() {
  if (rateLimitCache !== null) {
    return rateLimitCache;
  }

  const ajInstance = initializeArcjet();
  
  if (!ajInstance) {
    rateLimitCache = createFallbackRateLimit();
    return rateLimitCache;
  }

  try {
    const { fixedWindow, tokenBucket } = arcjetModule || require("@arcjet/next");
    
    rateLimitCache = {
      aiOperations: ajInstance.protect({
        rules: [
          fixedWindow({
            mode: "LIVE",
            window: "1m",
            max: 10,
          }),
          tokenBucket({
            mode: "LIVE",
            refillRate: 5,
            interval: "1m",
            capacity: 10,
          }),
        ],
      }),
      transactionCreate: ajInstance.protect({
        rules: [
          fixedWindow({
            mode: "LIVE",
            window: "1m",
            max: 20,
          }),
          tokenBucket({
            mode: "LIVE",
            refillRate: 10,
            interval: "1m",
            capacity: 20,
          }),
        ],
      }),
      api: ajInstance.protect({
        rules: [
          fixedWindow({
            mode: "LIVE",
            window: "1m",
            max: 60,
          }),
          tokenBucket({
            mode: "LIVE",
            refillRate: 30,
            interval: "1m",
            capacity: 60,
          }),
        ],
      }),
      accountOperations: ajInstance.protect({
        rules: [
          fixedWindow({
            mode: "LIVE",
            window: "1m",
            max: 15,
          }),
        ],
      }),
    };
  } catch (error) {
    console.error("Failed to create rate limit configurations:", error.message);
    rateLimitCache = createFallbackRateLimit();
  }

  return rateLimitCache;
}

function createFallbackRateLimit() {
  const noOpProtect = async (request, options) => ({
    isDenied: () => false,
    reason: {
      isRateLimit: () => false,
      isBot: () => false,
      retryAfter: 0,
    },
  });

  return {
    aiOperations: noOpProtect,
    transactionCreate: noOpProtect,
    api: noOpProtect,
    accountOperations: noOpProtect,
  };
}

// Export rateLimit - lazy loaded on first access
export const rateLimit = new Proxy({}, {
  get(target, prop) {
    const limits = getRateLimit();
    return limits[prop];
  },
  ownKeys() {
    const limits = getRateLimit();
    return Object.keys(limits);
  },
  has(target, prop) {
    const limits = getRateLimit();
    return prop in limits;
  },
});

/**
 * Rate limit wrapper for server actions
 * This function checks rate limits before executing server actions
 */
export async function withRateLimit(rateLimitType, action) {
  if (!ENABLE_ARCJET) {
    return await action();
  }

  try {
    const headersList = await headers();
    const { userId } = await auth();
    
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               headersList.get("x-real-ip") || 
               "unknown";

    const limits = getRateLimit();
    const limiter = limits[rateLimitType];
    
    if (!limiter) {
      console.warn(`Rate limit type "${rateLimitType}" not found, proceeding without rate limit`);
      return await action();
    }

    // Create a minimal request object for Arcjet
    const request = new Request("http://localhost", {
      headers: headersList,
    });

    // Call limiter directly (it's a function returned by aj.protect())
    const decision = await limiter(request, {
      userId: userId || undefined,
      ip: ip,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return {
          success: false,
          error: `Rate limit exceeded. Please try again in ${Math.ceil(decision.reason.retryAfter / 1000)} seconds.`,
        };
      }
      if (decision.reason.isBot()) {
        return {
          success: false,
          error: "Automated requests are not allowed.",
        };
      }
      return {
        success: false,
        error: "Request blocked by security policy.",
      };
    }

    return await action();
  } catch (error) {
    console.error("Rate limiting error:", error.message);
    // Fail open - allow the request if rate limiting fails
    return await action();
  }
}

export default initializeArcjet;
