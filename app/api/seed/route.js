import { seedTransactions } from "@/actions/seed";
import { rateLimit } from "@/lib/arcjet";
import { headers } from "next/headers";

export async function GET(request) {
  try {
    const headersList = await headers();
    // rateLimit.api is a function returned by aj.protect(), call it directly
    const decision = await rateLimit.api(request, {
      ip: headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown",
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return Response.json(
          { error: `Rate limit exceeded. Please try again in ${Math.ceil(decision.reason.retryAfter / 1000)} seconds.` },
          { status: 429 }
        );
      }
      return Response.json(
        { error: "Request blocked by security policy." },
        { status: 403 }
      );
    }

    const result = await seedTransactions();
    return Response.json(result);
  } catch (error) {
    console.error("API route error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}