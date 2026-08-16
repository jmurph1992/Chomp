import { Resend } from 'resend'

function resendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY ?? '')
}

/**
 * Foundation only — no templating, no call sites yet. `to` is always
 * caller-supplied; once a real feature calls this, it must source `to`
 * from the authenticated user's own verified email (Clerk), never from
 * unvalidated client input.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const { error } = await resendClient().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
    to: params.to,
    subject: params.subject,
    html: params.html,
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
}
