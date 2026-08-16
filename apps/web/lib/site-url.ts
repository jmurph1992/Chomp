/** Shared by anywhere that needs to build an absolute link (invite emails, activation emails). */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}
