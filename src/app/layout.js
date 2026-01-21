import './globals.css'
import { Geist, Geist_Mono } from 'next/font/google'
import Navigation from '@/components/Navigation'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata = {
  title: 'Labor Party Membership',
  description: 'Membership management for the Labor Party',
  icons: {
    icon: '/favicon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-gray-50 font-sans">
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  )
}
