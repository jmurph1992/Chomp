/**
 * Pure validation only — deliberately has zero server-only imports (no db,
 * no storage). truck-reviews.tsx (a client component) imports directly from
 * here rather than from lib/reviews.ts, which transitively pulls in
 * lib/storage.ts's Node-only deps (node:crypto, the AWS SDK) and breaks the
 * client bundle. Plain modules like this get bundled whole by webpack when a
 * client component imports them — unlike 'use server' action files, which
 * Next.js compiles into lightweight RPC stubs instead of inlining their
 * implementation. Never import lib/reviews.ts or lib/review-photos.ts
 * directly from a client component; go through a server action instead.
 */
export const MAX_REVIEW_BODY_LENGTH = 2000

export function isValidReviewBody(body: string | null | undefined): boolean {
  if (body === null || body === undefined || body === '') return true
  return typeof body === 'string' && body.length <= MAX_REVIEW_BODY_LENGTH
}
