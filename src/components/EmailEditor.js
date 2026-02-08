'use client'

import { useMemo, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'

// Dynamically import ReactQuill and register Font/Size whitelists
const ReactQuill = dynamic(
  () => import('react-quill-new').then((mod) => {
    const Quill = mod.default.Quill || mod.Quill
    if (Quill) {
      const Font = Quill.import('formats/font')
      Font.whitelist = ['serif', 'monospace']
      Quill.register(Font, true)

      const Size = Quill.import('formats/size')
      Size.whitelist = ['small', false, 'large', 'huge']
      Quill.register(Size, true)
    }
    return mod
  }),
  { ssr: false }
)

export default function EmailEditor({ value, onChange, placeholder = 'Enter your message...' }) {
  const editorRef = useRef(null)
  const internalValueRef = useRef(value)
  const skipNextUpdateRef = useRef(false)
  const isUserTypingRef = useRef(false)

  // Custom onChange that preserves image attributes
  const handleChange = useCallback((content, delta, source, editor) => {
    // Mark that user is typing to prevent external updates
    isUserTypingRef.current = true

    // Skip if we're in the middle of a custom operation
    if (skipNextUpdateRef.current) {
      skipNextUpdateRef.current = false
      isUserTypingRef.current = false
      return
    }

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

    // Clear typing flag after a short delay
    setTimeout(() => {
      isUserTypingRef.current = false
    }, 100)
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

          // Get current alignment from inline styles
          const getAlignment = () => {
            const ml = img.style.marginLeft
            const mr = img.style.marginRight
            if (ml === 'auto' && mr === 'auto') return 'center'
            if (ml === 'auto' && (mr === '0' || mr === '0px')) return 'right'
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

              // Apply alignment using inline styles directly on the image
              if (align === 'center') {
                img.style.display = 'block'
                img.style.marginLeft = 'auto'
                img.style.marginRight = 'auto'
              } else if (align === 'right') {
                img.style.display = 'block'
                img.style.marginLeft = 'auto'
                img.style.marginRight = '0'
              } else {
                img.style.display = 'block'
                img.style.marginLeft = '0'
                img.style.marginRight = 'auto'
              }

              wrapper.remove()

              // Get the HTML and update parent state directly
              // Skip the next Quill onChange to prevent it from re-parsing
              const html = editorElement.innerHTML
              internalValueRef.current = html

              // Directly update parent without going through Quill
              onChange(html)
            })
            btn.title = title
            wrapper.appendChild(btn)
          })

          // Separator before delete
          const sep2 = document.createElement('div')
          sep2.style.cssText = 'width: 1px; background: #e5e7eb; margin: 0 4px;'
          wrapper.appendChild(sep2)

          // Delete button
          const deleteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`
          const deleteBtn = document.createElement('button')
          deleteBtn.innerHTML = deleteSvg
          deleteBtn.type = 'button'
          deleteBtn.title = 'Delete image'
          deleteBtn.style.cssText = `
            padding: 6px 10px;
            font-size: 13px;
            font-weight: 500;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            background: white;
            color: #dc2626;
            cursor: pointer;
            transition: all 0.15s;
          `
          deleteBtn.onmouseenter = () => {
            deleteBtn.style.background = '#fef2f2'
            deleteBtn.style.borderColor = '#fca5a5'
          }
          deleteBtn.onmouseleave = () => {
            deleteBtn.style.background = 'white'
            deleteBtn.style.borderColor = '#e5e7eb'
          }
          deleteBtn.onclick = (e) => {
            e.preventDefault()
            e.stopPropagation()
            img.remove()
            wrapper.remove()
            const html = editorElement.innerHTML
            internalValueRef.current = html
            onChange(html)
          }
          wrapper.appendChild(deleteBtn)

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

  // Intercept pasted/dropped images and upload to R2 instead of embedding base64
  useEffect(() => {
    const editorElement = document.querySelector('.email-editor .ql-editor')
    if (!editorElement) return

    async function uploadImageFile(file) {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/admin/email/upload-image', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const { url } = await res.json()
      return url
    }

    function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          e.stopPropagation()
          const file = item.getAsFile()
          if (!file) return

          const quill = editorRef.current?.getEditor()
          if (!quill) return

          uploadImageFile(file).then(url => {
            const range = quill.getSelection(true)
            quill.insertEmbed(range?.index || 0, 'image', url)
          }).catch(err => {
            console.error('Paste image upload failed:', err)
            alert('Failed to upload pasted image: ' + err.message)
          })
          return
        }
      }
    }

    function handleDrop(e) {
      const files = e.dataTransfer?.files
      if (!files?.length) return

      const imageFile = Array.from(files).find(f => f.type.startsWith('image/'))
      if (!imageFile) return

      e.preventDefault()
      e.stopPropagation()

      const quill = editorRef.current?.getEditor()
      if (!quill) return

      uploadImageFile(imageFile).then(url => {
        const range = quill.getSelection(true)
        quill.insertEmbed(range?.index || 0, 'image', url)
      }).catch(err => {
        console.error('Drop image upload failed:', err)
        alert('Failed to upload dropped image: ' + err.message)
      })
    }

    editorElement.addEventListener('paste', handlePaste)
    editorElement.addEventListener('drop', handleDrop)

    return () => {
      editorElement.removeEventListener('paste', handlePaste)
      editorElement.removeEventListener('drop', handleDrop)
    }
  }, [])

  // Simplified toolbar for email composition
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'font': ['', 'serif', 'monospace'] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline'],
        [{ 'header': 1 }, { 'header': 2 }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': '' }, { 'align': 'center' }, { 'align': 'right' }],
        ['link', 'image'],
        ['insert-variable']
      ],
      handlers: {
        'insert-variable': function() {
          const cursorPosition = this.quill.getSelection()?.index || 0
          this.quill.insertText(cursorPosition, '{$name}')
          this.quill.setSelection(cursorPosition + 7)
        },
        'image': function() {
          const input = document.createElement('input')
          input.setAttribute('type', 'file')
          input.setAttribute('accept', 'image/jpeg,image/png,image/gif,image/webp')
          input.click()

          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return

            if (file.size > 5 * 1024 * 1024) {
              alert('Image too large. Maximum 5MB.')
              return
            }

            const formData = new FormData()
            formData.append('image', file)

            try {
              const res = await fetch('/api/admin/email/upload-image', {
                method: 'POST',
                body: formData,
              })

              if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Upload failed')
              }

              const { url } = await res.json()
              const range = this.quill.getSelection(true)
              this.quill.insertEmbed(range.index, 'image', url)
              this.quill.setSelection(range.index + 1)
            } catch (err) {
              console.error('Image upload failed:', err)
              alert('Failed to upload image: ' + err.message)
            }
          }
        }
      }
    },
    clipboard: {
      matchVisual: false,
    }
  }), [])

  const formats = [
    'font', 'size',
    'bold', 'italic', 'underline',
    'header',
    'list',
    'align',
    'link', 'image'
  ]

  // Track when value changes externally (e.g., template change or signature update)
  // and force update only when not typing
  useEffect(() => {
    // Only update if the external value is different from our internal tracking
    // AND the user is not currently typing
    if (value !== internalValueRef.current && !isUserTypingRef.current) {
      internalValueRef.current = value
      // Force Quill to update by accessing the editor instance
      if (editorRef.current) {
        const editor = editorRef.current.getEditor()
        const currentSelection = editor.getSelection()
        editor.clipboard.dangerouslyPasteHTML(value)
        // Restore selection if it existed
        if (currentSelection) {
          editor.setSelection(currentSelection)
        }
      }
    }
  }, [value])

  return (
    <div className="email-editor-wrapper">
      <ReactQuill
        ref={editorRef}
        theme="snow"
        defaultValue={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="email-editor"
      />
    </div>
  )
}
