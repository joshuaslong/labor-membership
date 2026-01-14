import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata = {
  title: 'Labor Party Membership',
  description: 'Membership management for the Labor Party',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  )
}
