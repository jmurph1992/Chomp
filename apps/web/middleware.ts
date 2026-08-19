import { NextResponse, type NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { isDemoMode, signupUrl } from './lib/demo'

// Routes anyone can view without signing in: discovery surfaces (map, feed,
// truck pages), auth pages themselves, the invite-claim landing page (an
// unauthenticated visitor needs to see what they're accepting before being
// bounced into sign-up — claimInviteAction itself still independently
// requires a session), and routes that authenticate themselves some other
// way (Clerk webhook via svix signature, Inngest via its own signing key)
// rather than via a Clerk session.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/trucks(.*)',
  '/feed(.*)',
  '/invite(.*)',
  '/api/webhooks(.*)',
  '/api/inngest(.*)',
])

// Demo mode only: routes that need a real Clerk session or a Clerk-rendered
// page (auth pages themselves, dashboard, account, admin) to do anything
// useful. The demo deployment has no Clerk keys/ClerkProvider at all, so
// rendering these would throw — bounce to the real app's signup URL instead.
const needsAccountRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/dashboard(.*)',
  '/account(.*)',
  '/admin(.*)',
])

function demoMiddleware(req: NextRequest) {
  if (needsAccountRoute(req)) {
    return NextResponse.redirect(new URL(signupUrl(), req.url))
  }
  return NextResponse.next()
}

export default isDemoMode()
  ? demoMiddleware
  : clerkMiddleware(async (auth, req) => {
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
