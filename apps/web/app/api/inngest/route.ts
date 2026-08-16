import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import {
  eraseUserFunction,
  notifyFavoritesOnActivationFunction,
  refreshFeedFunction,
} from '@/inngest/functions'

/**
 * Inngest's own handler for function execution, registration, and its
 * introspection UI. Public in middleware.ts — Inngest verifies requests via
 * INNGEST_SIGNING_KEY itself, same self-authenticating pattern as the Clerk
 * webhook route.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [refreshFeedFunction, eraseUserFunction, notifyFavoritesOnActivationFunction],
})
