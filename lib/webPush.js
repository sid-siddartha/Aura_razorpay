import webpush from "web-push";
import { db } from "@/lib/prisma";

// Configure VAPID details once at module load
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * Sends a push notification to all registered devices for a given Clerk userId.
 * Automatically cleans up expired or invalid subscriptions (410/404 responses).
 *
 * @param {string} userId - Clerk userId
 * @param {{ title: string, body: string, url?: string, icon?: string }} payload
 */
export async function sendPushNotificationToUser(userId, payload) {
    const subscriptions = await db.pushSubscription.findMany({
        where: { userId },
    });

    if (subscriptions.length === 0) return;

    const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth,
                        },
                    },
                    JSON.stringify(payload)
                );
            } catch (error) {
                // 404 or 410 = subscription is no longer valid — clean it up
                if (error.statusCode === 404 || error.statusCode === 410) {
                    console.log(
                        `[WebPush] Removing expired subscription for user ${userId}: ${sub.endpoint}`
                    );
                    await db.pushSubscription.delete({
                        where: { endpoint: sub.endpoint },
                    });
                } else {
                    console.error(
                        `[WebPush] Failed to send to ${sub.endpoint}:`,
                        error.message
                    );
                    throw error;
                }
            }
        })
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        console.warn(`[WebPush] ${failed.length} notification(s) failed for user ${userId}`);
    }
}
