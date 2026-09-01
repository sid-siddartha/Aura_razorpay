import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { createConsent } from "@/lib/setu/client";

/**
 * POST /api/account-aggregator/connect
 *
 * Initiates the Setu Account Aggregator consent flow for the authenticated user.
 *
 * Request body:  { mobileNumber: string }   // 10-digit Indian mobile, no country code
 * Response body: { consentUrl: string }      // Setu webview URL to redirect the user to
 */
export async function POST(req) {
  try {
    // ── 1. Authenticate via Clerk (server-side, never trust frontend userId) ──
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    // ── 2. Parse and validate request body ──
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    const { mobileNumber } = body;

    // Validate: must be exactly 10 digits
    if (!mobileNumber || !/^\d{10}$/.test(String(mobileNumber).trim())) {
      return NextResponse.json(
        { error: "Invalid mobile number. Please enter a 10-digit Indian mobile number." },
        { status: 400 }
      );
    }

    const sanitizedMobile = String(mobileNumber).trim();

    // ── 3. Resolve internal User record from Clerk userId ──
    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please try again after signing in." },
        { status: 404 }
      );
    }

    // ── 4. Upsert the AA connection record — status INITIATED ──
    // We upsert so that a user can re-initiate if a previous attempt failed.
    await db.accountAggregatorConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        mobileNumber: sanitizedMobile,
        status: "INITIATED",
      },
      update: {
        mobileNumber: sanitizedMobile,
        status: "INITIATED",
        // Clear out any stale consent data from a previous attempt
        consentId: null,
        consentUrl: null,
        vua: null,
      },
    });

    // ── 5. Build the callback/redirect URL for Setu ──
    // Setu redirects back here with ?success=true&id=<consentId> after the user completes the flow
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${appUrl}/api/account-aggregator/callback`;

    // ── 6. Call Setu — create the consent ──
    let setuConsent;
    try {
      setuConsent = await createConsent(sanitizedMobile, callbackUrl);
    } catch (setuError) {
      // Roll back our DB status to FAILED so the user can retry
      await db.accountAggregatorConnection.update({
        where: { userId: user.id },
        data: { status: "FAILED" },
      });

      console.error("[AA Connect] Setu createConsent error:", setuError.message);

      return NextResponse.json(
        {
          error:
            "Failed to initiate bank connection. Please try again in a moment.",
        },
        { status: 502 }
      );
    }

    // ── 7. Persist the Setu consent details — status PENDING ──
    await db.accountAggregatorConnection.update({
      where: { userId: user.id },
      data: {
        consentId: setuConsent.id,
        consentUrl: setuConsent.url,
        status: "PENDING",
      },
    });

    // ── 8. Return the Setu webview URL to the frontend ──
    return NextResponse.json(
      { consentUrl: setuConsent.url },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AA Connect] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
