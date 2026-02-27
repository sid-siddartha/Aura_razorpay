import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * Razorpay Webhook Handler
 * URL to register in Razorpay Dashboard:
 *   https://yourdomain.com/api/razorpay/webhook
 *
 * Events to enable:
 *   - payment.captured
 *   - payment.failed
 */
export async function POST(req) {
    try {
        const rawBody = await req.text(); // Must use raw text for signature verification
        const razorpaySignature = req.headers.get("x-razorpay-signature");

        if (!razorpaySignature) {
            return new NextResponse("Missing signature", { status: 400 });
        }

        // ── Step 1: Verify the webhook signature ─────────────────────────────────
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET not set");
            return new NextResponse("Server misconfigured", { status: 500 });
        }

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

        if (expectedSignature !== razorpaySignature) {
            console.warn("[Webhook] Invalid signature — possible spoofed request");
            return new NextResponse("Invalid signature", { status: 403 });
        }

        // ── Step 2: Parse and handle the event ───────────────────────────────────
        const event = JSON.parse(rawBody);
        const eventType = event.event;

        console.log("[Webhook] Received event:", eventType);

        if (eventType === "payment.captured") {
            const payment = event.payload.payment.entity;
            await handlePaymentCaptured(payment);
        } else if (eventType === "payment.failed") {
            const payment = event.payload.payment.entity;
            await handlePaymentFailed(payment);
        } else {
            console.log("[Webhook] Unhandled event type:", eventType);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Webhook] Processing error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

/**
 * Handles a successful payment — update DB record with payment details.
 */
async function handlePaymentCaptured(payment) {
    const {
        id: razorpayPaymentId,
        order_id: razorpayOrderId,
        amount,
        currency,
        contact: mobileNumber,
    } = payment;

    console.log("[Webhook] Payment captured:", razorpayPaymentId, "for order:", razorpayOrderId);

    await db.upiPayment.upsert({
        where: { razorpayOrderId },
        update: {
            razorpayPaymentId,
            paymentStatus: "PAID",
            // Update mobile if now available from payment entity
            ...(mobileNumber && { mobileNumber }),
        },
        create: {
            razorpayOrderId,
            razorpayPaymentId,
            mobileNumber: mobileNumber ?? "unknown",
            amount,
            currency,
            paymentStatus: "PAID",
        },
    });

    console.log("[Webhook] DB updated — payment marked as PAID");
}

/**
 * Handles a failed payment — mark the record as FAILED.
 */
async function handlePaymentFailed(payment) {
    const {
        order_id: razorpayOrderId,
        id: razorpayPaymentId,
        error_description,
    } = payment;

    console.warn("[Webhook] Payment failed for order:", razorpayOrderId, "Reason:", error_description);

    await db.upiPayment.upsert({
        where: { razorpayOrderId },
        update: {
            razorpayPaymentId,
            paymentStatus: "FAILED",
        },
        create: {
            razorpayOrderId,
            razorpayPaymentId,
            mobileNumber: payment.contact ?? "unknown",
            amount: payment.amount,
            currency: payment.currency ?? "INR",
            paymentStatus: "FAILED",
        },
    });

    console.log("[Webhook] DB updated — payment marked as FAILED");
}
