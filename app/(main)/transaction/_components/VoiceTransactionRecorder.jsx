"use client";

import { useEffect } from "react";
import { VoiceInput } from "@/components/VoiceInput";
import useFetch from "@/hooks/use-fetch";
import { processVoiceText } from "@/actions/transaction";
import { toast } from "sonner";

/**
 * Voice Transaction Recorder using Client-Side STT
 * Uses Web Speech API to convert voice to text in browser
 * Sends text (not audio) to server for parsing
 */
export function VoiceTransactionRecorder({ onVoiceComplete, onScanComplete }) {
  const {
    loading: processing,
    fn: processTextFn,
    data: voiceData,
  } = useFetch(processVoiceText);

  const handleTranscript = (transcript) => {
    // Real-time transcript updates (optional)
    console.log("Transcript updated:", transcript);
  };

  const handleComplete = async (transcript) => {
    if (!transcript || transcript.trim().length === 0) {
      // No toast - user can try again
      return;
    }

    console.log("Processing transcript:", transcript);
    await processTextFn(transcript);
  };

  // Handle processed data when it arrives
  useEffect(() => {
    if (voiceData && !processing) {
      console.log("VoiceTransactionRecorder - Calling callback with:", voiceData);
      const cb = onVoiceComplete || onScanComplete;
      if (typeof cb === "function") {
        try {
          cb(voiceData);
          // Only show success toast if meaningful data was extracted
          if (voiceData.amount && voiceData.amount > 0) {
            toast.success("Transaction details extracted!");
          }
          // No toast for partial/empty data - form will show the data
        } catch (err) {
          console.error("Error calling voice complete callback:", err);
        }
      }
    }
  }, [voiceData, processing, onVoiceComplete, onScanComplete]);

  return (
    <div className="w-full">
      <VoiceInput
        onTranscript={handleTranscript}
        onComplete={handleComplete}
      />
      {processing && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Processing transaction details...
        </p>
      )}
    </div>
  );
}
