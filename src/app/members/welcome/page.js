import Link from 'next/link'

export default function WelcomePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-12 text-center">
      <div className="card">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl text-gray-900 mb-4">Welcome to the Labor Party!</h1>
        <p className="text-lg text-gray-600 mb-8">
          Your membership is now active. You're part of something bigger.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
          <h2 className="font-bold text-gray-900 mb-3">What's next?</h2>
          <ul className="space-y-2 text-gray-600">
            <li>• Check your email for a confirmation receipt</li>
            <li>• Connect with your local chapter</li>
            <li>• Attend an upcoming meeting or event</li>
            <li>• Invite friends and family to join</li>
          </ul>
        </div>

        <div className="flex justify-center gap-4">
          <Link href="/chapters" className="btn-primary">Find Your Chapter</Link>
          <Link href="/" className="btn-secondary">Return Home</Link>
        </div>
      </div>
    </div>
  )
}
