'use client'

import { useEffect, useRef, useState } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import ClassicEditor from '@ckeditor/ckeditor5-build-classic'
import { Code, Pencil, Eye } from 'lucide-react'

// The prebuilt Classic bundle ships its own typings that are slightly out of
// sync with the @ckeditor/ckeditor5-react v11 expectations, so we loosen the
// constructor type here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Editor = ClassicEditor as any

type EditorMode = 'rich' | 'source' | 'preview'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

// CKEditor 5 wrapper with three modes:
//   - Rich Text: CKEditor WYSIWYG editing
//   - Source:    raw HTML textarea editing
//   - Preview:   renders the raw HTML in an isolated iframe so inline styles
//                (colors, fonts, backgrounds, etc.) display exactly as an
//                email client would show them — without CKEditor sanitization.
//
// The classic build is bundled and rendered client-side; import this component
// via next/dynamic with `ssr: false` to avoid referencing `window` during SSR.
export default function RichTextEditor({ value, onChange, placeholder, id }: RichTextEditorProps) {
  const [mode, setMode] = useState<EditorMode>('rich')
  // Draft used while editing raw HTML so the textarea stays stable.
  const [draft, setDraft] = useState(value)
  // Keep a handle on the CKEditor instance so we can sync data when leaving
  // rich-text mode.
  const editorRef = useRef<any>(null)
  // Force CKEditor remount when switching back to rich-text so it picks up
  // the latest HTML (e.g. after source edits).
  const [editorKey, setEditorKey] = useState(0)

  // Keep the source draft in sync with external value changes when not actively
  // editing in source mode.
  useEffect(() => {
    if (mode !== 'source') {
      setDraft(value)
    }
  }, [value, mode])

  const switchMode = (next: EditorMode) => {
    // Before leaving rich-text mode, flush the editor's current data so the
    // parent state stays in sync (CKEditor may have normalized the HTML).
    if (mode === 'rich' && editorRef.current && next !== 'rich') {
      onChange(editorRef.current.getData())
    }
    // Before leaving source mode, push the draft back to the parent.
    if (mode === 'source' && next !== 'source') {
      onChange(draft)
    }
    // When entering rich-text mode, force a remount so CKEditor loads the
    // latest HTML (which may include inline styles added in source mode).
    if (next === 'rich' && mode !== 'rich') {
      setEditorKey((k) => k + 1)
    }
    setMode(next)
  }

  const tabs: { key: EditorMode; label: string; icon: typeof Code }[] = [
    { key: 'rich', label: 'Rich Text', icon: Pencil },
    { key: 'source', label: 'Source', icon: Code },
    { key: 'preview', label: 'Preview', icon: Eye },
  ]

  return (
    <div id={id} className="rich-text-editor overflow-hidden rounded-md border">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 border-b bg-gray-50 px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = mode === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchMode(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Rich Text — CKEditor WYSIWYG */}
      {mode === 'rich' && (
        <CKEditor
          key={editorKey}
          editor={Editor}
          data={value}
          onReady={(editor: any) => {
            editorRef.current = editor
          }}
          config={{
            placeholder,
            toolbar: {
              items: [
                'heading',
                'style',
                '|',
                'bold',
                'italic',
                'underline',
                'strikethrough',
                'subscript',
                'superscript',
                'code',
                'removeFormat',
                '|',
                'fontSize',
                'fontFamily',
                'fontColor',
                'fontBackgroundColor',
                'highlight',
                '|',
                'alignment',
                'numberedList',
                'bulletedList',
                'todoList',
                'outdent',
                'indent',
                'blockQuote',
                '|',
                'link',
                'insertTable',
                'horizontalLine',
                'imageUpload',
                'imageInsert',
                'mediaEmbed',
                '|',
                'findAndReplace',
                'selectAll',
                '|',
                'undo',
                'redo'
              ]
            },
            image: {
              toolbar: [
                'imageTextAlternative',
                'toggleImageCaption',
                'imageStyle:inline',
                'imageStyle:block',
                'imageStyle:side',
                'linkImage'
              ]
            },
            table: {
              contentToolbar: [
                'tableColumn',
                'tableRow',
                'mergeTableCells',
                'tableCellProperties',
                'tableProperties'
              ]
            }
          }}
          onChange={(_event: any, editor: any) => {
            editorRef.current = editor
            onChange(editor.getData())
          }}
        />
      )}

      {/* Source — raw HTML textarea */}
      {mode === 'source' && (
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            onChange(e.target.value)
          }}
          placeholder={placeholder}
          spellCheck={false}
          className="block min-h-[300px] w-full resize-y border-0 bg-white p-3 font-mono text-sm leading-relaxed text-gray-900 outline-none"
        />
      )}

      {/* Preview — render raw HTML in an isolated iframe for full style fidelity */}
      {mode === 'preview' && (
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;background:#fff;}img{max-width:100%;height:auto;}table{border-collapse:collapse;}a{color:#2563eb;}</style></head><body>${value || `<p style="color:#9ca3af;font-style:italic;">${placeholder || 'Nothing to preview'}</p>`}</body></html>`}
          className="block min-h-[300px] w-full border-0 bg-white"
        />
      )}
    </div>
  )
}
