import { SignUp } from '@clerk/nextjs'
import { safeRedirectPath } from '@/lib/redirect'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const { redirect_url: redirectUrl } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <SignUp fallbackRedirectUrl={safeRedirectPath(redirectUrl)} />
    </main>
  )
}
