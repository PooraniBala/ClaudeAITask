import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt, COOKIE_NAME } from '@/lib/auth'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (token) {
    const session = await verifyJwt(token)
    if (session) redirect('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
