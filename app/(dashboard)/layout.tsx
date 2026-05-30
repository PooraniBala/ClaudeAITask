import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt, refreshSession, COOKIE_NAME } from '@/lib/auth'
import { Navbar } from '@/components/layout/navbar'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) redirect('/login')

  const session = await verifyJwt(token)
  if (!session) redirect('/login')

  // Extend session on every page load (sliding expiry)
  await refreshSession(session.sessionId)

  return (
    <div className="flex min-h-screen">
      <Sidebar activePath="" />
      <div className="flex flex-1 flex-col">
        <Navbar user={{ email: session.email }} />
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    </div>
  )
}
