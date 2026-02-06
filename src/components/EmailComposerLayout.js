'use client'

import PropTypes from 'prop-types'

/**
 * Two-column layout for email composer
 * - Desktop: Form on left, sticky preview on right
 * - Mobile: Stacked vertically (form then preview)
 */
function EmailComposerLayout({
  children,
  preview,
  header,
  actions
}) {
  return (
    <div className="min-h-[calc(100vh-61px)]">
      {/* Header */}
      {header && (
        <div className="px-6 py-4 border-b border-stone-200 bg-white">
          {header}
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col lg:flex-row">
        {/* Left column - Form */}
        <div className="flex-1 lg:max-w-2xl">
          <div className="p-6 space-y-6">
            {children}
          </div>

          {/* Actions - visible on mobile, at bottom of form */}
          {actions && (
            <div className="lg:hidden sticky bottom-0 bg-white border-t border-stone-200 p-4">
              {actions}
            </div>
          )}
        </div>

        {/* Right column - Preview (desktop) */}
        <div className="hidden lg:block w-[480px] border-l border-stone-200 bg-stone-50">
          <div className="sticky top-[61px] h-[calc(100vh-61px)] overflow-y-auto">
            <div className="p-6">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
                Preview
              </div>
              {preview}
            </div>

            {/* Actions - desktop, below preview */}
            {actions && (
              <div className="p-6 pt-0">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview - Mobile (below form) */}
      <div className="lg:hidden border-t border-stone-200 bg-stone-50 p-6">
        <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
          Preview
        </div>
        {preview}
      </div>
    </div>
  )
}

EmailComposerLayout.displayName = 'EmailComposerLayout'

EmailComposerLayout.propTypes = {
  children: PropTypes.node.isRequired,
  preview: PropTypes.node.isRequired,
  header: PropTypes.node,
  actions: PropTypes.node
}

export default EmailComposerLayout
