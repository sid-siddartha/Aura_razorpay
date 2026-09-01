"use client";

import { useState, useEffect } from "react";
import {
  Landmark,
  Phone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

/**
 * BankConnectionBanner
 *
 * Multi-step UI for the Setu Account Aggregator onboarding flow.
 *
 * States:
 *  - "cta"     → shows the "Connect Bank Account" card
 *  - "form"    → mobile number input + +91 prefix
 *  - "loading" → calling our backend
 *  - "success" → returned from Setu with ?aa=success
 *  - "error"   → backend/network error
 *
 * Props:
 *  - aaConnection: null | { status: string, mobileNumber: string, consentUrl: string }
 */
export function BankConnectionBanner({ aaConnection }) {
  // Detect success return from Setu via query param
  const [step, setStep] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("aa") === "success") return "success";
    }
    return "cta";
  });

  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  // Clean ?aa=success from the URL after reading it
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("aa") === "success") {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, []);

  // If already connected, don't render the banner at all
  if (aaConnection?.status === "CONNECTED") {
    return null;
  }

  // ── Validate mobile number ──────────────────────────────────────────────────
  function validateMobile(value) {
    if (!value) return "Mobile number is required.";
    if (!/^\d{10}$/.test(value)) return "Enter a valid 10-digit Indian mobile number.";
    return "";
  }

  // ── Handle form submission ──────────────────────────────────────────────────
  async function handleConnect(e) {
    e.preventDefault();
    const trimmed = mobileNumber.trim();
    const validationError = validateMobile(trimmed);
    if (validationError) {
      setMobileError(validationError);
      return;
    }
    setMobileError("");
    setApiError("");
    setIsSubmitting(true);
    setStep("loading");

    try {
      const res = await fetch("/api/account-aggregator/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to connect. Please try again.");
      }

      if (!data.consentUrl) {
        throw new Error("No consent URL received from server.");
      }

      // Redirect the user to Setu's hosted consent webview
      window.location.href = data.consentUrl;
    } catch (err) {
      setApiError(err.message || "An unexpected error occurred.");
      setStep("error");
      setIsSubmitting(false);
    }
  }

  // ── Shared card wrapper ─────────────────────────────────────────────────────
  function Card({ children }) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
        {/* Decorative background circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-100 rounded-full opacity-40 pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-purple-100 rounded-full opacity-30 pointer-events-none" />
        <div className="relative">{children}</div>
      </div>
    );
  }

  // ── CTA state ───────────────────────────────────────────────────────────────
  if (step === "cta") {
    return (
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Icon */}
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Landmark className="w-7 h-7 text-white" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">
              Connect your bank account
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Automatically import your transactions into Aura and keep your
              financial data up to date.
            </p>
          </div>

          {/* CTA Button */}
          <button
            id="aa-connect-cta-btn"
            onClick={() => setStep("form")}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-200 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Connect Bank Account
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Card>
    );
  }

  // ── Form state ──────────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <Card>
        <div className="max-w-md">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow shadow-indigo-200">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Connect your bank account
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Enter the mobile number registered with your bank.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleConnect} noValidate>
            <label
              htmlFor="aa-mobile-input"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Mobile Number
            </label>

            {/* Phone input with +91 prefix */}
            <div
              className={`flex items-center border rounded-xl overflow-hidden transition-colors focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 ${
                mobileError ? "border-red-400" : "border-gray-200"
              }`}
            >
              <span className="bg-gray-50 border-r border-gray-200 px-3 py-2.5 text-sm text-gray-500 font-medium select-none">
                +91
              </span>
              <input
                id="aa-mobile-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobileNumber}
                onChange={(e) => {
                  // Only allow digits
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setMobileNumber(val);
                  if (mobileError) setMobileError(validateMobile(val));
                }}
                placeholder="9999999999"
                className="flex-1 px-3 py-2.5 text-sm bg-white text-gray-900 placeholder-gray-400 outline-none"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {mobileError && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {mobileError}
              </p>
            )}

            <p className="text-xs text-gray-400 mt-2">
              You&apos;ll be redirected to complete OTP verification securely.
            </p>

            {/* Buttons */}
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setStep("cta")}
                disabled={isSubmitting}
                className="flex-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-xl py-2.5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="aa-mobile-submit-btn"
                type="submit"
                disabled={isSubmitting || mobileNumber.length !== 10}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-xl py-2.5 shadow-md shadow-indigo-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </form>
        </div>
      </Card>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Initiating bank connection…
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Securely connecting to the Account Aggregator. Please wait.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              Connection failed
            </p>
            <p className="text-xs text-red-500 mt-0.5 break-words">
              {apiError || "Something went wrong. Please try again."}
            </p>
          </div>
          <button
            id="aa-retry-btn"
            onClick={() => {
              setApiError("");
              setStep("form");
            }}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-100 rounded-2xl p-6 shadow-sm">
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-emerald-100 rounded-full opacity-40 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow shadow-emerald-200">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">
              ✓ Bank account connected successfully
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Your bank accounts and recent 3 months of transactions have been synced with your Aura dashboard.
            </p>
          </div>

          {/* Dismiss & Refresh Dashboard */}
          <button
            id="aa-success-continue-btn"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow shadow-emerald-200 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Continue to Aura
          </button>
        </div>
      </div>
    );
  }

  return null;
}
