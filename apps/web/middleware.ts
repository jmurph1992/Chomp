import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes anyone can view without signing in: discovery surfaces (map, feed,
// truck pages), auth pages themselves, and routes that authenticate
// themselves some other way (Clerk webhook via svix signature, Inngest via
// its own signing key) rather than via a Clerk session.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/trucks(.*)',
  '/feed(.*)',
  '/api/webhooks(.*)',
  '/api/inngest(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
