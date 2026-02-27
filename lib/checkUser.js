import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma.js";
import { log } from "console";

// The function checkUser ensures that whenever someone logs into your app with Clerk (an authentication provider), you also have a corresponding record for them in your own database (Prisma in this case).
// If the user already exists in your database → just return that user.
// If the user doesn’t exist yet → create a new record in your database using their Clerk info.
// This way, you can later associate things like posts, orders, bookings, etc. with your own database’s user records, not just Clerk’s authentication info.

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  try {
    // db.user.findUnique() → finds a user in your DB.
    const loggedInUser = await db.user.findUnique({
        // where: { clerkUserId: user.id } → checks if the Clerk user ID matches someone in your DB.
      where: {
        clerkUserId: user.id,
      },
    });

    if (loggedInUser) {
      return loggedInUser;
    }

    const name = `${user.firstName} ${user.lastName}`;

    const newUser = await db.user.create({
      data: {
        clerkUserId: user.id,
        name,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0].emailAddress,
      },
    });

    return newUser;
  } catch (error) {
    console.log(error.message);
  }
};