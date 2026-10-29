'use client'

import React, { useState } from 'react'
import { Check, Copy, Download, FileCode2, FileJson, FileText, Terminal } from 'lucide-react'
import type { GeneratedFile } from './types'
import { Button } from './Button'
import { cn } from './lib'

const ICON: Record<GeneratedFile['language'], React.ReactNode> = {
  json: <FileJson size={14} strokeWidth={1.5} />,
  yaml: <FileCode2 size={14} strokeWidth={1.5} />,
  typescript: <FileCode2 size={14} strokeWidth={1.5} />,
  markdown: <FileText size={14} strokeWidth={1.5} />,
  bash: <Terminal size={14} strokeWidth={1.5} />,
  text: <FileText size={14} strokeWidth={1.5} />,
}

/** Builds a client-side file download from generated content — no server involved. */
export function downloadFiles(name: string, files: GeneratedFile[]) {
  const body = files.map((f) => `===== ${f.path} =====\n${f.content}`).join('\n\n')
  const blob = new Blob([body], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download preview: file tree + code viewer with copy, and a download action.
 * Used for consumer setup packages and enterprise blueprints.
 */
export function DownloadPreview({ name, files, onDownload, meta }: { name: string; files: GeneratedFile[]; onDownload?: () => void; meta?: React.ReactNode }) {
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const file = files[active] ?? files[0] ?? { path: '', language: 'text' as const, content: '' }
  const copy = () => {
    navigator.clipboard?.writeText(file.content).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-label-md text-fg">{name}</p>
          {meta && <div className="mt-0.5 text-label-sm text-fg-muted">{meta}</div>}
        </div>
        <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={onDownload ?? (() => downloadFiles(name, files))}>
          Download
        </Button>
      </header>
      <div className="grid md:grid-cols-[220px_1fr]">
        <ul className="flex gap-1 overflow-x-auto border-b border-line p-2 md:flex-col md:border-r md:border-b-0" role="tablist" aria-label="Files">
          {files.map((f, i) => (
            <li key={f.path}>
              <button
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  'flex w-full items-center gap-2 whitespace-nowrap rounded-xs px-2 py-1.5 text-left font-mono text-code-sm transition-colors duration-150',
                  i === active ? 'bg-sunken text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                {ICON[f.language]}
                {f.path}
              </button>
            </li>
          ))}
        </ul>
        <div className="relative min-w-0 bg-sunken">
          <button onClick={copy} aria-label="Copy file" className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-xs border border-line bg-surface px-2 py-1 text-label-sm text-fg-2 transition-colors duration-150 hover:text-fg">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre className="max-h-[420px] overflow-auto p-4 pr-20 font-mono text-code-sm text-fg-2">
            {file.content.split('\n').map((line, i) => (
              <div key={i} className="flex">
                <span className="mr-4 inline-block w-6 shrink-0 text-right text-fg-muted select-none">{i + 1}</span>
                <span className={cn('whitespace-pre', /^\s*(#|\/\/)/.test(line) && 'text-fg-muted')}>{line || ' '}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  )
}
