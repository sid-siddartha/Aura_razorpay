import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * POST /api/account-aggregator/webhook
 *
 * Setu sends a webhook notification here when a consent status changes.
 * This endpoint must be registered as the notification URL in Setu Bridge.
 *
 * For local development, expose this with:
 *   npx ngrok http 3000
 * Then register: https://<your-ngrok>.ngrok-free.app/api/account-aggregator/webhook
 *
 * Setu webhook payload (consent notification):
 * {
 *   "type": "CONSENT_STATUS_UPDATE",
 *   "timestamp": "...",
 *   "consentId": "<uuid>",
 *   "status": "APPROVED" | "REJECTED" | "REVOKED" | "PAUSED" | "EXPIRED"
 * }
 *
 * We always return 200 to Setu. Failures are logged for debugging.
 */
export async function POST(req) {
  try {
    let payload;
    try {
      payload = await req.json();
    } catch {
      // Malformed payload — return 200 anyway so Setu doesn't keep retrying
      console.error("[AA Webhook] Failed to parse request body");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const { consentId, status, type } = payload;

    // Only process consent status updates
    if (type !== "CONSENT_STATUS_UPDATE") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!consentId) {
      console.error("[AA Webhook] Missing consentId in payload:", payload);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Map Setu consent statuses to our internal statuses
    let internalStatus;
    switch (status) {
      case "APPROVED":
      case "ACTIVE":
        internalStatus = "CONNECTED";
        break;
      case "REJECTED":
      case "REVOKED":
      case "EXPIRED":
        internalStatus = "FAILED";
        break;
      case "PENDING":
        internalStatus = "PENDING";
        break;
      default:
        // Unknown status — log but don't update
        console.warn(`[AA Webhook] Unknown consent status: ${status}`);
        return NextResponse.json({ received: true }, { status: 200 });
    }

    // Find and update the matching connection record
    const connection = await db.accountAggregatorConnection.findFirst({
      where: { consentId },
    });

    if (!connection) {
      console.warn(
        `[AA Webhook] No connection found for consentId: ${consentId}`
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (internalStatus === "CONNECTED") {
      try {
        const { fetchAndSyncTransactions } = await import("@/lib/setu/client");
        await fetchAndSyncTransactions(consentId, connection.userId);
      } catch (syncErr) {
        console.error("[AA Webhook] Error syncing transactions:", syncErr);
        await db.accountAggregatorConnection.update({
          where: { id: connection.id },
          data: { status: "CONNECTED" },
        });
      }
    } else {
      await db.accountAggregatorConnection.update({
        where: { id: connection.id },
        data: { status: internalStatus },
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[AA Webhook] Unexpected error:", error);
    // Always return 200 to prevent Setu from retrying indefinitely
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
