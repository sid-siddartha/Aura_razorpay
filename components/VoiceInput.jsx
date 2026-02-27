"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Client-side Speech-to-Text using Web Speech API
 * Converts voice to text in browser - no server STT needed
 */
export function VoiceInput({ onTranscript, onComplete }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      initializeRecognition();
    } else {
      setIsSupported(false);
      console.warn("Web Speech API not supported in this browser");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const initializeRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN"; // Indian English

    recognition.onstart = () => {
      setIsListening(true);
      // No toast - UI already shows listening state
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript || interimTranscript;
      setTranscript(fullTranscript.trim());
      
      // Call onTranscript callback with current transcript
      if (onTranscript && fullTranscript.trim()) {
        onTranscript(fullTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      // Only show toasts for critical errors
      if (event.error === "not-allowed") {
        toast.error("Microphone permission denied.");
      } else if (event.error !== "no-speech") {
        // Don't show toast for "no-speech" - it's handled in stopListening
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  };

  const startListening = () => {
    if (!isSupported) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    if (recognitionRef.current) {
      try {
        setTranscript("");
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting recognition:", error);
        toast.error("Failed to start voice recognition");
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      
      if (transcript.trim()) {
        // No toast here - processing toast will come from parent component
        if (onComplete) {
          onComplete(transcript.trim());
        }
      }
      // No toast for empty transcript - let parent handle it if needed
    }
  };

  // Removed handleSubmit and handleClear - no longer needed

  if (!isSupported) {
    return (
      <div className="w-full p-4 border rounded-lg bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-800">
          Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {/* Control Button */}
      <Button
        type="button"
        variant={isListening ? "destructive" : "default"}
        className={`w-full ${
          isListening
            ? "bg-red-500 hover:bg-red-600"
            : "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white hover:opacity-90"
        }`}
        onClick={isListening ? stopListening : startListening}
      >
        {isListening ? (
          <>
            <Square className="mr-2 h-4 w-4" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="mr-2 h-4 w-4" />
            Start Recording
          </>
        )}
      </Button>

      {isListening && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          🎤 Listening... Speak clearly
        </p>
      )}
    </div>
  );
}

