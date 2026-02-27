import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const subscription = await req.json();

        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return new NextResponse("Invalid subscription payload", { status: 400 });
        }

        // Upsert: if endpoint already exists, update keys and re-associate with userId
        await db.pushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            update: {
                userId,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
            create: {
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("[API /push-subscription] Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { endpoint } = await req.json();
        if (!endpoint) {
            return new NextResponse("Missing endpoint", { status: 400 });
        }

        // Ensure the subscription belongs to this user before deleting
        await db.pushSubscription.deleteMany({
            where: { endpoint, userId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API /push-subscription] DELETE Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
