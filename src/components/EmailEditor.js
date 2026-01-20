'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

export default function EmailEditor({ value, onChange, placeholder = 'Enter your message...' }) {
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
