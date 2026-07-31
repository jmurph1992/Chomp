import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes anyone can view without signing in: discovery surfaces (map, feed,
// truck pages), auth pages themselves, and the Clerk webhook (which is
// authenticated by svix signature, not a Clerk session).
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/trucks(.*)',
  '/feed(.*)',
  '/api/webhooks(.*)',
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
