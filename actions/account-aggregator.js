"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

/**
 * Fetch the Account Aggregator connection for the currently signed-in user.
 * Returns null if the user is not signed in or has no connection record.
 */
export async function getAAConnection() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Look up our internal User record via Clerk userId
  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      aaConnection: {
        select: {
          id: true,
          mobileNumber: true,
          consentId: true,
          consentUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) return null;

  return user.aaConnection ?? null;
}
