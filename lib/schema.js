// Validation schema (Zod): Protects your application before data gets sent to your backend/database, often used in routes, controllers, or API layers.

//Validating on the backend (with Zod, etc.) is essential because you cannot fully trust that form settings alone will prevent bad data from reaching your application. Backend validation gives you security, stability, and data consistency.

// That’s a great question! While you do set “number” or “string” types in your HTML forms or frontend frameworks, there are still important reasons to validate data again on the backend using libraries like Zod:

// Why Backend Validation Is Still Needed
// Frontends Can Be Bypassed:
// Users (or attackers) can bypass form restrictions using browser developer tools, custom scripts, or API clients (like Hopscotch/Postman). They can send any kind of data, regardless of your form settings.

// Browsers Don’t Guarantee Data Types:
// Even if you set <input type="number">, the data from the browser will arrive at your backend as a string. You cannot trust that the type is correct until you process and validate it.

// Different Sources of Data:
// Not all data comes from your forms. Other systems, mobile apps, or third-party APIs could send data to your backend, skipping your frontend rules entirely.

// Security and Consistency:
// Validating types and formats on the backend protects against hacks and mistakes, ensuring only safe, correctly structured data affects your system.

// Application Logic:
// You might have business rules that go beyond simple types—like checking if a number is positive, dates are valid, strings have certain formats, etc.—which require explicit validation.

import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["CURRENT", "SAVINGS"]),
  balance: z.string().min(1, "Initial balance is required"),
});


export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: z.string().min(1, "Amount is required"),
    description: z.string().optional(),
    date: z.date({ required_error: "Date is required" }),
    accountId: z.string().min(1, "Account is required"),
    category: z.string().min(1, "Category is required"),
    isRecurring: z.boolean().default(false),
    recurringInterval: z
      .enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurringInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Recurring interval is required for recurring transactions",
        path: ["recurringInterval"],
      });
    }
  });

