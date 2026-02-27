// This file, dashboard.js inside the actions folder, contains server-side logic for handling account-related tasks in a web application—specifically, for creating new user accounts and serializing data to be safely and correctly sent to the client/frontend.
"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { withRateLimit } from "@/lib/arcjet";

const serializeTransaction = (obj) => {
  const serialized = { ...obj };
  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount) {
    serialized.amount = obj.amount.toNumber();
  }
  return serialized;
};

export async function createAccount(data) {
  return withRateLimit("accountOperations", async () => {
    try {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

    // Find the user
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    // Validate and parse balance
    const balanceFloat = parseFloat(data.balance);
    if (isNaN(balanceFloat)) {
      throw new Error("Invalid balance amount");
    }

    // Check if this is the user’s first account
    const existingAccounts = await db.account.findMany({
      where: { userId: user.id },
    });

    const shouldBeDefault =
      existingAccounts.length === 0 ? true : data.isDefault;

    // If this account should be default, unset other default accounts
    if (shouldBeDefault) {
      await db.account.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create the account
    const account = await db.account.create({
      data: {
        ...data,
        balance: balanceFloat,
        userId: user.id,
        isDefault: shouldBeDefault,
      },
    });

    // Serialize the account
      const serializedAccount = serializeTransaction(account);

      // Revalidate dashboard cache
      revalidatePath("/dashboard");

      return { success: true, data: serializedAccount };
    } catch (error) {
      throw new Error(error.message);
    }
  });
}


//get the user accounts
export async function getUserAccounts(){
  const {userId} = await auth();
  if(!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId : userId },
  });

  if(!user){
    throw new Error("User not found");
  }

  //This includes in each returned account object a count of how many related transactions exist for that account. The _count field is a special Prisma feature to return relation counts efficiently.
  const accounts = await db.account.findMany({
    where : { userId : user.id},
    orderBy:{ createdAt : "desc"},
    include: {
      _count: {
        select : {
          transactions : true,
        },
      },
    },
  });

      // Serialize the account
    const serializedAccount = accounts.map(serializeTransaction);

    return serializedAccount;


}


export async function getDashboardData() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get all user transactions
  const transactions = await db.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  return transactions.map(serializeTransaction);
}


