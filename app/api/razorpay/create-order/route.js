import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

// Initialise Razorpay once (server-side only — key never reaches the browser)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function POST(req) {
    try {
        // Auth gate — only signed-in users can create orders
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { amount, mobileNumber } = await req.json();

        // Validate inputs
        if (!amount || typeof amount !== "number" || amount <= 0) {
            return NextResponse.json(
                { error: "Invalid amount. Must be a positive number (in rupees)." },
                { status: 400 }
            );
        }
        if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
            return NextResponse.json(
                { error: "Invalid Indian mobile number." },
                { status: 400 }
            );
        }

        // Razorpay amount is in PAISE (multiply ₹ by 100)
        const amountPaise = Math.round(amount * 100);

        // Create order on Razorpay
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                mobile_number: mobileNumber,
                clerk_user_id: userId,
            },
        });

        // Persist the order in DB immediately (status: CREATED)
        await db.upiPayment.create({
            data: {
                razorpayOrderId: order.id,
                mobileNumber,
                amount: amountPaise,
                currency: "INR",
                paymentStatus: "CREATED",
            },
        });

        // Return ONLY the data the frontend needs — secret key never leaves here
        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (error) {
        console.error("[Razorpay] Order creation failed:", error);
        return NextResponse.json(
            { error: "Failed to create payment order." },
            { status: 500 }
        );
    }
}
