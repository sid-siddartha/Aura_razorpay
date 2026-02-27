
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/arcjet';

/**
 * Middleware to protect routes using Clerk authentication.
 * This middleware ensures that users must be authenticated to access protected routes,
 * such as the dashboard. If a user attempts to access the dashboard or other protected
 * pages without being logged in, they will be redirected to the login page.
 * The `matcher` configuration specifies which routes require authentication, including
 * API routes and excluding static files and Next.js internals.
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/account(.*)",
  "/transaction(.*)",
]);

const isApiRoute = createRouteMatcher([
  "/api(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Apply rate limiting to API routes
  if (isApiRoute(req) && !req.nextUrl.pathname.startsWith('/api/inngest')) {
    try {
      const ip = req.headers.get("x-forwarded-for") || 
                 req.headers.get("x-real-ip") || 
                 req.ip || 
                 "unknown";
      
      // rateLimit.api is a function returned by aj.protect(), call it directly
      const decision = await rateLimit.api(req, {
        userId: userId || undefined,
        ip: ip,
      });

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return new Response(
            JSON.stringify({ 
              error: `Rate limit exceeded. Please try again in ${Math.ceil(decision.reason.retryAfter / 1000)} seconds.` 
            }),
            { 
              status: 429,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        if (decision.reason.isBot()) {
          return new Response(
            JSON.stringify({ error: "Automated requests are not allowed." }),
            { 
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return new Response(
          JSON.stringify({ error: "Request blocked by security policy." }),
          { 
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } catch (error) {
      console.error("Rate limiting error in middleware:", error);
      // Continue with the request if rate limiting fails
    }
  }

  if (!userId && isProtectedRoute(req)) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }
});


export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};