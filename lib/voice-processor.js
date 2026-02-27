import OpenAI from "openai";
import { isOpenAIEnabled, isGeminiEnabled, isVoiceEnabled } from "./aiStatus";
import { callGeminiAPI } from "./gemini";
import { parseLocalVoice } from "./localVoiceParser";

/**
 * Process voice audio and extract transaction data
 * ALWAYS returns structured data - never empty objects
 * Works even when ALL AI services fail
 */
export async function processVoiceAudio(audioFile) {
  // Always return structured data - never check flags that would prevent processing
  let transcript = null;
  let audioMetadata = null;

  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");
    const audioMimeType = audioFile.type || "audio/webm";

    // Capture audio metadata (always available, even if AI fails)
    audioMetadata = {
      size: audioFile.size,
      type: audioMimeType,
      name: audioFile.name || "voice-recording",
      timestamp: new Date().toISOString(),
    };

    console.log("Processing voice audio - type:", audioMimeType, "size:", audioFile.size);

    // Try to get transcript from AI (but don't fail if it doesn't work)
    transcript = await attemptTranscription(audioFile, base64String, audioMimeType);
    
    // ALWAYS try local parsing - even if transcript is null
    // Local parsing will return a structure that allows form population
    return processWithLocalParser(transcript, audioMetadata);
  } catch (error) {
    console.error("Voice processing error:", error.message);
    // ALWAYS return structured data - never empty object
    return processWithLocalParser(null, audioMetadata);
  }
}

/**
 * Attempt to get transcript from AI services
 * Returns transcript or null - never throws
 */
async function attemptTranscription(audioFile, base64String, audioMimeType) {
  // Try OpenAI first
  if (isOpenAIEnabled()) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioMimeType });
      const audioFileForOpenAI = new File([audioBlob], audioFile.name || "audio.webm", { 
        type: audioMimeType 
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFileForOpenAI,
        model: "whisper-1",
        language: "en",
      });

      const transcript = transcription.text?.trim();
      if (transcript && transcript.length > 0) {
        console.log("OpenAI transcription succeeded:", transcript);
        return transcript;
      }
    } catch (error) {
      console.warn("OpenAI transcription failed (non-fatal):", error.message);
      // Continue to next attempt
    }
  }

  // Try Gemini as fallback
  if (isGeminiEnabled()) {
    try {
      const prompt = "Transcribe this audio to text. Return only the transcribed text, no explanations.";
      const text = await callGeminiAPI(prompt, base64String, audioMimeType);
      const transcript = text?.trim();
      if (transcript && transcript.length > 0) {
        console.log("Gemini transcription succeeded:", transcript);
        return transcript;
      }
    } catch (error) {
      console.warn("Gemini transcription failed (non-fatal):", error.message);
      // Continue - will use local parsing
    }
  }

  // No transcript available - that's okay, local parser will handle it
  console.log("No transcript available from AI services - using local parser fallback");
  return null;
}

/**
 * Process with local parser - ALWAYS returns structured data
 * Works with or without transcript
 */
function processWithLocalParser(transcript, audioMetadata) {
  // If we have transcript, parse it
  if (transcript && transcript.trim().length > 0) {
    const parsed = parseLocalVoice(transcript);
    
    // Convert to form-compatible format
    return {
      amount: parsed.amount ?? 0,
      date: parsed.date ? new Date(parsed.date) : new Date(),
      description: parsed.description || "",
      merchantName: parsed.merchantName || "",
      category: parsed.category || "other-expense",
      _source: parsed._source || "voice",
    };
  }

  // No transcript available - return structure that allows form population
  // User can enter details manually, but form is ready
  console.log("No transcript available - returning structure for manual entry");
  return {
    amount: 0,
    date: new Date(),
    description: "",
    merchantName: "",
    category: "other-expense",
    _source: "voice",
    _manualEntry: true, // Flag to indicate user needs to enter manually
  };
}

// Removed processWithGemini - transcription is now handled in attemptTranscription
// This function is no longer needed as we always use local parser

function normalizeVoiceData(data) {
  // Process date string (handle relative dates)
  let date = new Date();
  if (data.date) {
    const dateStr = String(data.date).toUpperCase().trim();
    if (dateStr === "TODAY_IST" || dateStr === "TODAY") {
      date = new Date();
    } else if (dateStr === "YESTERDAY_IST" || dateStr === "YESTERDAY") {
      date = new Date();
      date.setDate(date.getDate() - 1);
    } else if (dateStr === "TOMORROW_IST" || dateStr === "TOMORROW") {
      date = new Date();
      date.setDate(date.getDate() + 1);
    } else {
      try {
        const parsedDate = new Date(data.date);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      } catch (e) {
        console.warn("Failed to parse date:", data.date);
      }
    }
  }

  // Build description intelligently
  let description = "";
  if (data.description) {
    description = data.description;
  } else if (data.merchant) {
    description = data.merchant;
  } else if (data.merchantName) {
    description = data.merchantName;
  }

  // If we have both merchant and description, combine them
  const merchant = data.merchant || data.merchantName || "";
  if (merchant && description && !description.toLowerCase().includes(merchant.toLowerCase())) {
    description = `${merchant} - ${description}`;
  } else if (merchant && !description) {
    description = merchant;
  }

  return {
    amount: data.amount ? parseFloat(data.amount) : 0,
    date: date,
    description: description || "",
    merchantName: merchant || "",
    category: data.category || "other-expense",
  };
}

// Removed tryLocalParsing and createFallbackResult
// Now handled by processWithLocalParser which always runs

