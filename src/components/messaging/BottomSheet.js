'use client'

export default function BottomSheet({ isOpen, onClose, children }) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-slide-up w-full md:max-w-sm md:mx-4 rounded-t-xl md:rounded-xl bg-white shadow-lg pb-safe">
        {children}
      </div>
    </div>
  )
}
