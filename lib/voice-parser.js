/**
 * Local voice parsing fallback
 * Extracts transaction data from text using regex and heuristics
 * Used when AI services are unavailable or fail
 */

// Category keywords mapping
const CATEGORY_KEYWORDS = {
  groceries: ["grocery", "groceries", "supermarket", "food store", "mart", "walmart", "target", "costco"],
  food: ["restaurant", "cafe", "coffee", "lunch", "dinner", "breakfast", "food", "eat", "pizza", "burger", "mcdonald", "kfc"],
  transportation: ["uber", "taxi", "gas", "fuel", "petrol", "diesel", "parking", "metro", "bus", "train", "flight", "airline"],
  shopping: ["shop", "store", "mall", "amazon", "purchase", "buy", "bought"],
  utilities: ["electricity", "water", "internet", "phone", "mobile", "utility", "bill"],
  entertainment: ["movie", "cinema", "netflix", "spotify", "game", "entertainment", "fun"],
  healthcare: ["doctor", "hospital", "pharmacy", "medicine", "medical", "health"],
  education: ["school", "tuition", "course", "book", "education", "university"],
  travel: ["hotel", "travel", "trip", "vacation", "holiday"],
  housing: ["rent", "mortgage", "house", "apartment", "home"],
  bills: ["bill", "payment", "subscription"],
  insurance: ["insurance", "premium"],
  gifts: ["gift", "present"],
};

/**
 * Extract transaction data from text using local parsing
 * Returns structured data even when AI is unavailable
 */
export function parseTransactionFromText(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const lowerText = text.toLowerCase().trim();
  
  // Extract amount - look for numbers with currency indicators
  const amountPatterns = [
    /(\d+(?:\.\d{2})?)\s*(?:rupees?|rs|inr|dollars?|usd|\$|₹)/i,
    /(?:rupees?|rs|inr|dollars?|usd|\$|₹)\s*(\d+(?:\.\d{2})?)/i,
    /(\d+(?:\.\d{2})?)\s*(?:spent|paid|cost|for)/i,
    /spent\s+(\d+(?:\.\d{2})?)/i,
    /paid\s+(\d+(?:\.\d{2})?)/i,
    /(\d+(?:\.\d{2})?)\s+on/i,
  ];

  let amount = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0) {
        break;
      }
    }
  }

  // Extract merchant/store name
  // Look for "at [store]", "from [store]", "to [store]"
  const merchantPatterns = [
    /(?:at|from|to|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:store|shop|mart|market|restaurant|cafe)/gi,
  ];

  let merchant = null;
  for (const pattern of merchantPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // Take the last match (usually the store name)
      merchant = matches[matches.length - 1][1].trim();
      if (merchant.length > 1 && merchant.length < 50) {
        break;
      }
    }
  }

  // Extract category from keywords
  let category = "other-expense";
  let maxMatches = 0;
  
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      category = cat;
    }
  }

  // Extract description - try to get meaningful text
  let description = text.trim();
  
  // Clean up common phrases
  description = description
    .replace(/^(i|i've|i have)\s+(spent|paid|bought|purchased)\s+/i, "")
    .replace(/\s+(on|at|from|for)\s*$/i, "")
    .trim();

  // If we have merchant, include it in description
  if (merchant && !description.toLowerCase().includes(merchant.toLowerCase())) {
    description = `${merchant} - ${description}`;
  }

  // Limit description length
  if (description.length > 100) {
    description = description.substring(0, 97) + "...";
  }

  // Only return data if we found at least an amount
  if (amount === null) {
    return null;
  }

  return {
    amount: amount,
    merchant: merchant || null,
    description: description || null,
    category: category,
    date: null, // Will default to today in the processor
  };
}

/**
 * Try to extract basic info even from minimal text
 * More lenient parsing for edge cases
 */
export function parseMinimalTransaction(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  // Just look for any number
  const numberMatch = text.match(/(\d+(?:\.\d{2})?)/);
  if (numberMatch) {
    const amount = parseFloat(numberMatch[1]);
    if (!isNaN(amount) && amount > 0) {
      return {
        amount: amount,
        merchant: null,
        description: text.trim().substring(0, 100),
        category: "other-expense",
        date: null,
      };
    }
  }

  return null;
}

