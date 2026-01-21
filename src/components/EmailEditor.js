'use client'

import { useMemo, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

export default function EmailEditor({ value, onChange, placeholder = 'Enter your message...' }) {
  const editorRef = useRef(null)

  // Set up image click handler for resize controls
  useEffect(() => {
    const setupImageResize = () => {
      const editor = editorRef.current?.getEditor?.()
      if (!editor) return

      const editorElement = editor.root

      const handleImageClick = (e) => {
        if (e.target.tagName === 'IMG') {
          // Remove any existing resize controls
          document.querySelectorAll('.image-resize-controls').forEach(el => el.remove())

          const img = e.target
          const wrapper = document.createElement('div')
          wrapper.className = 'image-resize-controls'
          wrapper.style.cssText = `
            position: absolute;
            display: flex;
            gap: 4px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 100;
          `

          const sizes = [
            { label: 'S', width: 100 },
            { label: 'M', width: 200 },
            { label: 'L', width: 300 },
            { label: 'XL', width: 400 },
            { label: 'Full', width: null },
          ]

          sizes.forEach(({ label, width }) => {
            const btn = document.createElement('button')
            btn.textContent = label
            btn.type = 'button'
            btn.style.cssText = `
              padding: 4px 8px;
              font-size: 12px;
              font-weight: 500;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              background: ${img.width === width || (width === null && !img.style.maxWidth) ? '#E25555' : 'white'};
              color: ${img.width === width || (width === null && !img.style.maxWidth) ? 'white' : '#374151'};
              cursor: pointer;
            `
            btn.onmouseover = () => {
              if (img.width !== width) btn.style.background = '#f3f4f6'
            }
            btn.onmouseout = () => {
              if (img.width !== width) btn.style.background = 'white'
            }
            btn.onclick = (e) => {
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
              // Trigger change
              onChange(editor.root.innerHTML)
            }
            wrapper.appendChild(btn)
          })

          // Position the controls above the image
          const rect = img.getBoundingClientRect()
          const editorRect = editorElement.getBoundingClientRect()
          wrapper.style.left = (rect.left - editorRect.left) + 'px'
          wrapper.style.top = (rect.top - editorRect.top - 40) + 'px'

          editorElement.style.position = 'relative'
          editorElement.appendChild(wrapper)

          // Remove controls when clicking elsewhere
          const removeControls = (e) => {
            if (!wrapper.contains(e.target) && e.target !== img) {
              wrapper.remove()
              document.removeEventListener('click', removeControls)
            }
          }
          setTimeout(() => document.addEventListener('click', removeControls), 0)
        }
      }

      editorElement.addEventListener('click', handleImageClick)
      return () => editorElement.removeEventListener('click', handleImageClick)
    }

    // Delay to ensure editor is mounted
    const timer = setTimeout(setupImageResize, 500)
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
    'list', 'bullet',
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
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="email-editor"
      />
    </div>
  )
}
