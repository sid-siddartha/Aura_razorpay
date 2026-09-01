import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { fetchAndSyncTransactions } from "@/lib/setu/client";

/**
 * GET /api/account-aggregator/callback
 *
 * Setu redirects the user here after they complete (or reject) the consent flow.
 *
 * Setu's query params (per docs):
 *   ?success=true&id=<consentId>                          (approved)
 *   ?success=false&id=<consentId>&errorcode=1&errormsg=.. (rejected/cancelled)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const success = searchParams.get("success");      // "true" or "false"
    const consentId = searchParams.get("id");         // consent UUID
    const errorcode = searchParams.get("errorcode");  // "1" = rejected, "5" = cancelled

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!consentId) {
      return NextResponse.redirect(`${appUrl}/dashboard?aa=success`);
    }

    // Find the matching connection record
    const connection = await db.accountAggregatorConnection.findFirst({
      where: { consentId },
    });

    if (connection) {
      if (success === "false") {
        // User rejected or cancelled — mark as FAILED
        await db.accountAggregatorConnection.update({
          where: { id: connection.id },
          data: { status: "FAILED" },
        });
        return NextResponse.redirect(`${appUrl}/dashboard?aa=rejected`);
      }

      // If approved or success=true, trigger immediate transaction fetch & sync!
      try {
        await fetchAndSyncTransactions(consentId, connection.userId);
      } catch (syncErr) {
        console.error("[AA Callback] Transaction sync error:", syncErr);
        // Even if immediate sync had a hiccup, mark as CONNECTED so user is verified
        await db.accountAggregatorConnection.update({
          where: { id: connection.id },
          data: { status: "CONNECTED" },
        });
      }
    }

    return NextResponse.redirect(`${appUrl}/dashboard?aa=success`);
  } catch (error) {
    console.error("[AA Callback] Error:", error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/dashboard?aa=success`);
  }
}

