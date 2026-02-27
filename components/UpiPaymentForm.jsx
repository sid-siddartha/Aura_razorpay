"use client";

import { useState } from "react";

/**
 * Loads the Razorpay checkout script dynamically.
 * Returns true if loaded successfully.
 */
function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (document.getElementById("razorpay-script")) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.id = "razorpay-script";
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export function UpiPaymentForm() {
    const [mobileNumber, setMobileNumber] = useState("");
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'failed' | null

    const handlePayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            // 1. Load Razorpay checkout JS
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) throw new Error("Failed to load Razorpay SDK");

            // 2. Create order via our secure backend
            const res = await fetch("/api/razorpay/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: parseFloat(amount), // in rupees
                    mobileNumber,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Order creation failed");
            }

            const { orderId, amount: orderAmount, currency } = await res.json();

            // 3. Open Razorpay checkout
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // ONLY public key here
                amount: orderAmount,      // in paise — returned by server
                currency,
                name: "Aura Finance",
                description: "UPI Payment",
                order_id: orderId,
                prefill: {
                    contact: mobileNumber,
                },
                method: {
                    upi: true,              // Enable UPI as primary method
                    card: false,
                    netbanking: false,
                    wallet: false,
                },
                theme: { color: "#6366f1" },
                handler: (response) => {
                    // Payment verified on server via webhook
                    // response.razorpay_payment_id is available here for reference
                    console.log("Payment successful:", response.razorpay_payment_id);
                    setStatus("success");
                },
                modal: {
                    ondismiss: () => {
                        console.log("Payment modal dismissed");
                        setLoading(false);
                    },
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", (response) => {
                console.error("Payment failed:", response.error);
                setStatus("failed");
                setLoading(false);
            });
            rzp.open();
        } catch (error) {
            console.error("Payment error:", error.message);
            setStatus("failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4">UPI Payment</h2>

            {status === "success" && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                    ✅ Payment successful! Your transaction has been recorded.
                </div>
            )}
            {status === "failed" && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    ❌ Payment failed. Please try again.
                </div>
            )}

            <form onSubmit={handlePayment} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mobile Number
                    </label>
                    <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="9876543210"
                        pattern="[6-9][0-9]{9}"
                        maxLength={10}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (₹)
                    </label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100"
                        min="1"
                        step="0.01"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Processing..." : `Pay ₹${amount || "0"} via UPI`}
                </button>
            </form>
        </div>
    );
}
