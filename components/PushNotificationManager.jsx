"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { urlBase64ToUint8Array } from "@/lib/webPushUtils";

/**
 * Drop this component anywhere inside your authenticated layout.
 * It registers the service worker, requests notification permission,
 * and saves the push subscription to your backend — all silently.
 *
 * Example usage in app/layout.js (inside <ClerkProvider>):
 *   import { PushNotificationManager } from "@/components/PushNotificationManager";
 *   ...
 *   <PushNotificationManager />
 */
export function PushNotificationManager() {
    const { isLoaded, userId } = useAuth();

    useEffect(() => {
        // Only run when Clerk has confirmed there's a signed-in user
        if (!isLoaded || !userId) return;

        async function registerPush() {
            // Guard: check browser support
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                console.warn("[Push] Not supported in this browser.");
                return;
            }

            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!publicKey) {
                console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");
                return;
            }

            try {
                // Register the service worker
                const registration = await navigator.serviceWorker.register("/sw.js", {
                    scope: "/",
                });

                // Request notification permission
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    console.log("[Push] Permission denied by user.");
                    return;
                }

                // Check if already subscribed (avoid duplicate API calls)
                let subscription = await registration.pushManager.getSubscription();

                if (!subscription) {
                    // Create a new subscription
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicKey),
                    });
                }

                // Save / refresh the subscription on the server
                await fetch("/api/push-subscription", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(subscription),
                });
            } catch (error) {
                console.error("[Push] Registration error:", error);
            }
        }

        registerPush();
    }, [isLoaded, userId]);

    // Purely functional — renders nothing
    return null;
}
