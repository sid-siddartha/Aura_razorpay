/**
 * Local Voice Parser
 * Extracts transaction data from plain text using regex and heuristics
 * Works for Indian usage (rupees, INR)
 * Never throws - always returns structured data
 */

// Category keyword mapping for Indian context
const CATEGORY_KEYWORDS = {
  groceries: [
    "grocery", "groceries", "supermarket", "food store", "mart", "dmart", "d-mart", 
    "big bazaar", "reliance", "more", "spencer", "hypermarket", "kirana", "provision"
  ],
  food: [
    "restaurant", "cafe", "coffee", "lunch", "dinner", "breakfast", "food", "eat", 
    "pizza", "burger", "mcdonald", "kfc", "dominos", "swiggy", "zomato", "uber eats",
    "hotel", "dhaba", "tiffin", "thali", "biryani", "paratha", "samosa"
  ],
  transportation: [
    "uber", "ola", "taxi", "auto", "rickshaw", "gas", "fuel", "petrol", "diesel", 
    "parking", "metro", "bus", "train", "flight", "airline", "irctc", "booking",
    "cab", "driver", "travel"
  ],
  shopping: [
    "shop", "store", "mall", "amazon", "flipkart", "myntra", "purchase", "buy", 
    "bought", "clothes", "apparel", "fashion", "electronics", "mobile", "phone"
  ],
  utilities: [
    "electricity", "water", "internet", "phone", "mobile", "utility", "bill",
    "bsnl", "airtel", "jio", "vi", "vodafone", "broadband", "wifi"
  ],
  entertainment: [
    "movie", "cinema", "pvr", "inox", "netflix", "prime", "hotstar", "spotify", 
    "game", "entertainment", "fun", "theater", "show"
  ],
  healthcare: [
    "doctor", "hospital", "pharmacy", "medicine", "medical", "health", "clinic",
    "apollo", "fortis", "medicines", "tablets", "prescription"
  ],
  education: [
    "school", "tuition", "course", "book", "education", "university", "college",
    "fees", "coaching", "classes"
  ],
  travel: [
    "hotel", "travel", "trip", "vacation", "holiday", "booking", "stay", "resort"
  ],
  housing: [
    "rent", "mortgage", "house", "apartment", "home", "maintenance", "society"
  ],
  bills: [
    "bill", "payment", "subscription", "recharge", "prepaid", "postpaid"
  ],
  insurance: [
    "insurance", "premium", "policy", "lic", "health insurance", "car insurance"
  ],
  gifts: [
    "gift", "present", "donation"
  ],
};

/**
 * Extract transaction data from plain text
 * @param {string} text - Plain text input (voice transcription)
 * @returns {object} Structured transaction data with exact shape
 */
export function parseLocalVoice(text) {
  // Always return the exact shape, never throw
  const defaultResult = {
    amount: null,
    merchantName: null,
    category: null,
    description: "",
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    _source: "voice",
  };

  if (!text || typeof text !== "string") {
    return defaultResult;
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return defaultResult;
  }

  try {
    // Step 1: Normalize input
    const normalized = normalizeInput(trimmedText);
    
    // Step 2: Extract amount first and remove it from text
    const { amount, remainingText } = extractAndRemoveAmount(normalized);
    
    // Step 3: Remove filler words
    const cleanedText = removeFillerWords(remainingText);
    
    // Step 4: Extract clean description (noun phrase only)
    const description = extractCleanDescription(cleanedText);
    
    // Step 5: Extract category from cleaned text
    const category = extractCategory(cleanedText);
    
    // Step 6: Extract merchant (optional)
    const merchantName = extractMerchant(cleanedText);

    return {
      amount: amount,
      merchantName: merchantName,
      category: category,
      description: description,
      date: defaultResult.date,
      _source: "voice",
    };
  } catch (error) {
    // Never throw - return default structure
    console.warn("Local voice parser error (non-fatal):", error.message);
    return defaultResult;
  }
}

/**
 * Normalize input text
 * - Convert to lowercase
 * - Remove punctuation
 * - Collapse multiple spaces
 */
function normalizeInput(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Extract amount and remove it from text
 * Returns { amount: number | null, remainingText: string }
 */
function extractAndRemoveAmount(text) {
  // Patterns to find amount (in order of priority)
  // Each pattern includes the full match for removal
  const amountPatterns = [
    // Explicit: "amount 60"
    { pattern: /\bamount\s+(\d+(?:\.\d{1,2})?)\b/i, removePattern: /\bamount\s+\d+(?:\.\d{1,2})?\b/i },
    // "200 rupees", "200 rs", "200 inr"
    { pattern: /\b(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|₹)\b/i, removePattern: /\b\d+(?:\.\d{1,2})?\s*(?:rupees?|rs\.?|inr|₹)\b/i },
    // "rupees 200", "rs 200", "₹200"
    { pattern: /\b(?:rupees?|rs\.?|inr|₹)\s*(\d+(?:\.\d{1,2})?)\b/i, removePattern: /\b(?:rupees?|rs\.?|inr|₹)\s*\d+(?:\.\d{1,2})?\b/i },
    // "spent 200", "paid 200"
    { pattern: /\b(?:spent|paid|cost)\s+(\d+(?:\.\d{1,2})?)\b/i, removePattern: /\b(?:spent|paid|cost)\s+\d+(?:\.\d{1,2})?\b/i },
    // "200 spent", "200 paid"
    { pattern: /\b(\d+(?:\.\d{1,2})?)\s+(?:spent|paid|on)\b/i, removePattern: /\b\d+(?:\.\d{1,2})?\s+(?:spent|paid|on)\b/i },
    // Standalone number (2+ digits) - only if it's clearly an amount
    { pattern: /\b(\d{2,}(?:\.\d{1,2})?)\b/, removePattern: /\b\d{2,}(?:\.\d{1,2})?\b/ },
  ];

  let amount = null;
  let remainingText = text;

  for (const { pattern, removePattern } of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const extractedAmount = parseFloat(match[1]);
      if (!isNaN(extractedAmount) && extractedAmount > 0 && extractedAmount < 10000000) {
        amount = extractedAmount;
        // Remove the matched amount pattern from text
        remainingText = text.replace(removePattern, " ").replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  return { amount, remainingText };
}

/**
 * Remove filler words from text
 * Removes: "is", "was", "for", "on", "and", "paid", "spent", "amount", "description"
 */
function removeFillerWords(text) {
  const fillerWords = [
    "is", "was", "are", "were", "be", "been", "being",
    "for", "on", "at", "to", "from", "in", "of",
    "and", "or", "but", "the", "a", "an",
    "paid", "spent", "bought", "purchased", "got", "have", "had",
    "amount", "description", "rupees", "rs", "inr",
    "i", "i've", "i'm", "i have", "i am",
  ];

  // Split into words and filter out filler words
  const words = text.split(/\s+/).filter(word => {
    const lowerWord = word.toLowerCase().trim();
    return lowerWord.length > 0 && !fillerWords.includes(lowerWord);
  });

  return words.join(" ").trim();
}

/**
 * Extract clean description (noun phrase only)
 * Removes any remaining filler words and extracts meaningful content
 */
function extractCleanDescription(text) {
  if (!text || text.trim().length === 0) {
    return "";
  }

  // Handle explicit "description X" pattern
  const descPattern = /\bdescription\s+(.+)/i;
  const descMatch = text.match(descPattern);
  if (descMatch) {
    return removeFillerWords(descMatch[1]).trim();
  }

  // Remove common prefixes that might remain
  let cleaned = text
    .replace(/^(the|a|an)\s+/i, "") // Remove articles
    .replace(/\s+(the|a|an)\s+/gi, " ") // Remove articles in middle
    .trim();

  // If text is too short or only contains numbers, return empty
  if (cleaned.length < 2 || /^\d+$/.test(cleaned)) {
    return "";
  }

  // Limit length
  if (cleaned.length > 150) {
    cleaned = cleaned.substring(0, 147) + "...";
  }

  return cleaned;
}

/**
 * Extract amount from text
 * Handles Indian currency: rupees, rs, inr, ₹
 */
function extractAmount(text) {
  const lowerText = text.toLowerCase();
  
  // Patterns for Indian currency and explicit patterns
  const amountPatterns = [
    // Explicit: "amount 60", "amount 200" (highest priority)
    /amount\s+(\d+(?:\.\d{1,2})?)/i,
    // "200 rupees", "200 rs", "200 inr"
    /(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|₹)/i,
    // "rupees 200", "rs 200", "₹200"
    /(?:rupees?|rs\.?|inr|₹)\s*(\d+(?:\.\d{1,2})?)/i,
    // "spent 200", "paid 200", "200 spent"
    /(?:spent|paid|cost|for)\s+(\d+(?:\.\d{1,2})?)/i,
    /(\d+(?:\.\d{1,2})?)\s+(?:spent|paid|on)/i,
    // "200 on groceries"
    /(\d+(?:\.\d{1,2})?)\s+on/i,
    // Standalone number (if context suggests it's an amount)
    /(\d{2,}(?:\.\d{1,2})?)/,
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 10000000) { // Reasonable limit
        return amount;
      }
    }
  }

  return null;
}

/**
 * Extract merchant/store name from text
 * Looks for patterns: "at [merchant]", "from [merchant]", "to [merchant]"
 */
function extractMerchant(text) {
  // Patterns to find merchant names
  const merchantPatterns = [
    // "at D Mart", "at Walmart", "at Reliance"
    /\b(?:at|from|to|in)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g,
    // "D Mart store", "Walmart shop"
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:store|shop|mart|market|restaurant|cafe|mall)/gi,
    // Capitalized words that might be merchant names (2-3 words max)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g,
  ];

  const candidates = [];
  
  for (const pattern of merchantPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const candidate = match[1].trim();
      // Filter out common words that aren't merchants
      const skipWords = [
        "i", "spent", "paid", "bought", "purchased", "on", "at", "from", "to",
        "rupees", "rs", "inr", "for", "the", "a", "an", "this", "that",
        "today", "yesterday", "tomorrow", "groceries", "food", "shopping"
      ];
      
      if (
        candidate.length >= 2 &&
        candidate.length <= 50 &&
        !skipWords.includes(candidate.toLowerCase()) &&
        !candidates.includes(candidate)
      ) {
        candidates.push(candidate);
      }
    }
  }

  // Return the most likely merchant (usually the last one mentioned)
  if (candidates.length > 0) {
    return candidates[candidates.length - 1];
  }

  return null;
}

/**
 * Extract category from text using keyword matching
 */
function extractCategory(text) {
  const lowerText = text.toLowerCase();
  let bestCategory = null;
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score += 1;
        // Boost score for exact word matches
        const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (wordBoundaryRegex.test(text)) {
          score += 2;
        }
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

// buildDescription function removed - now handled by extractCleanDescription

