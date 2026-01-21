'use client'

import { useMemo, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

export default function EmailEditor({ value, onChange, placeholder = 'Enter your message...' }) {
  const editorRef = useRef(null)
  const internalValueRef = useRef(value)

  // Track internal value to prevent re-render loops
  useEffect(() => {
    internalValueRef.current = value
  }, [value])

  // Custom onChange that preserves image attributes
  const handleChange = useCallback((content, delta, source, editor) => {
    // Get raw HTML from editor DOM to preserve data attributes
    const editorElement = document.querySelector('.email-editor .ql-editor')
    if (editorElement) {
      const html = editorElement.innerHTML
      internalValueRef.current = html
      onChange(html)
    } else {
      internalValueRef.current = content
      onChange(content)
    }
  }, [onChange])

  // Set up image click handler for resize controls
  useEffect(() => {
    // Use a longer delay and interval to ensure editor is ready
    let attempts = 0
    const maxAttempts = 10

    const trySetup = () => {
      const editorElement = document.querySelector('.email-editor .ql-editor')
      if (!editorElement) {
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(trySetup, 300)
        }
        return
      }

      const handleImageClick = (e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault()
          e.stopPropagation()

          // Remove any existing resize controls
          document.querySelectorAll('.image-resize-controls').forEach(el => el.remove())

          const img = e.target
          const wrapper = document.createElement('div')
          wrapper.className = 'image-resize-controls'
          wrapper.style.cssText = `
            position: fixed;
            display: flex;
            gap: 4px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 9999;
          `

          const sizes = [
            { label: 'S', width: 100 },
            { label: 'M', width: 200 },
            { label: 'L', width: 300 },
            { label: 'XL', width: 400 },
            { label: 'Full', width: null },
          ]

          // Helper to create styled button
          const createButton = (label, isActive, onClick) => {
            const btn = document.createElement('button')
            btn.innerHTML = label
            btn.type = 'button'
            btn.style.cssText = `
              padding: 6px 12px;
              font-size: 13px;
              font-weight: 500;
              border: 1px solid ${isActive ? '#E25555' : '#e5e7eb'};
              border-radius: 4px;
              background: ${isActive ? '#E25555' : 'white'};
              color: ${isActive ? 'white' : '#374151'};
              cursor: pointer;
              transition: all 0.15s;
            `
            btn.onmouseenter = () => {
              if (!isActive) {
                btn.style.background = '#f3f4f6'
                btn.style.borderColor = '#d1d5db'
              }
            }
            btn.onmouseleave = () => {
              if (!isActive) {
                btn.style.background = 'white'
                btn.style.borderColor = '#e5e7eb'
              }
            }
            btn.onclick = onClick
            return btn
          }

          // Get current alignment from class or styles
          const getAlignment = () => {
            if (img.classList.contains('align-center')) return 'center'
            if (img.classList.contains('align-right')) return 'right'
            if (img.classList.contains('align-left')) return 'left'
            return 'left'
          }
          const currentAlign = getAlignment()

          // Size buttons
          sizes.forEach(({ label, width }) => {
            const isActive = (width && img.width === width) || (width === null && img.style.width === '100%')
            const btn = createButton(label, isActive, (e) => {
              e.preventDefault()
              e.stopPropagation()
              if (width) {
                img.setAttribute('width', width)
                img.style.width = width + 'px'
                img.style.maxWidth = width + 'px'
              } else {
                img.removeAttribute('width')
                img.style.width = '100%'
                img.style.maxWidth = '100%'
              }
              img.style.height = 'auto'
              wrapper.remove()

              // Update parent state with raw HTML
              const html = editorElement.innerHTML
              internalValueRef.current = html
              onChange(html)
            })
            wrapper.appendChild(btn)
          })

          // Separator
          const sep = document.createElement('div')
          sep.style.cssText = 'width: 1px; background: #e5e7eb; margin: 0 4px;'
          wrapper.appendChild(sep)

          // Alignment buttons - using inline SVGs
          const leftSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3V21"/><path d="M9 12L12 15"/><path d="M9 12L12 9"/><path d="M20 12H9"/></g></svg>`
          const centerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12L18 15"/><path d="M9 12L6 15"/><path d="M15 12L18 9"/><path d="M9 12L6 9"/><path d="M22 12H15.5"/><path d="M2 12H8.5"/><path d="M12 3V21"/></g></svg>`
          const rightSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 3V21"/><path d="M15 12L12 15"/><path d="M15 12L12 9"/><path d="M4 12H15"/></g></svg>`
          const alignments = [
            { label: leftSvg, align: 'left', title: 'Align left' },
            { label: centerSvg, align: 'center', title: 'Center' },
            { label: rightSvg, align: 'right', title: 'Align right' },
          ]

          alignments.forEach(({ label, align, title }) => {
            const isActive = currentAlign === align
            const btn = createButton(label, isActive, (e) => {
              e.preventDefault()
              e.stopPropagation()

              // Remove existing alignment classes
              img.classList.remove('align-left', 'align-center', 'align-right')
              // Add new alignment class
              img.classList.add(`align-${align}`)

              wrapper.remove()

              // Update parent state with raw HTML (don't trigger re-render)
              const html = editorElement.innerHTML
              internalValueRef.current = html
              onChange(html)
            })
            btn.title = title
            wrapper.appendChild(btn)
          })

          // Position the controls above the image using fixed positioning
          const rect = img.getBoundingClientRect()
          wrapper.style.left = rect.left + 'px'
          wrapper.style.top = (rect.top - 50) + 'px'

          document.body.appendChild(wrapper)

          // Remove controls when clicking elsewhere
          const removeControls = (evt) => {
            if (!wrapper.contains(evt.target) && evt.target !== img) {
              wrapper.remove()
              document.removeEventListener('mousedown', removeControls)
            }
          }
          setTimeout(() => document.addEventListener('mousedown', removeControls), 10)
        }
      }

      editorElement.addEventListener('click', handleImageClick)

      return () => {
        editorElement.removeEventListener('click', handleImageClick)
        document.querySelectorAll('.image-resize-controls').forEach(el => el.remove())
      }
    }

    const timer = setTimeout(trySetup, 500)
    return () => clearTimeout(timer)
  }, [onChange])

  // Custom toolbar configuration matching the Slate.js example
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub' }, { 'script': 'super' }],
        [{ 'header': '1' }, { 'header': '2' }, { 'header': '3' }, 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['code-block'],
        ['clean'],
        ['insert-variable']  // Custom button
      ],
      handlers: {
        'insert-variable': function() {
          const cursorPosition = this.quill.getSelection()?.index || 0
          this.quill.insertText(cursorPosition, '{$name}')
          this.quill.setSelection(cursorPosition + 7)
        }
      }
    },
    clipboard: {
      matchVisual: false,
    }
  }), [])

  const formats = [
    'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'header', 'blockquote',
    'list',
    'align',
    'link', 'image', 'video',
    'code-block'
  ]

  return (
    <div className="email-editor-wrapper">
      <ReactQuill
        ref={editorRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="email-editor"
      />
    </div>
  )
}
