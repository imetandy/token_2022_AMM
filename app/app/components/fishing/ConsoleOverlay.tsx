"use client"

import React, { useEffect, useRef, useState } from "react"

export default function ConsoleOverlay() {
  const [lines, setLines] = useState<string[]>([])
  const prevRef = useRef<{ log: any; error: any; warn: any } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Capture current console methods and override
    const previous = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    }
    prevRef.current = previous

    const push = (prefix: string, args: any[]) => {
      const text = `${prefix} ${args.map((a) => {
        try { return typeof a === 'string' ? a : JSON.stringify(a) } catch { return String(a) }
      }).join(' ')}`
      setLines((prev) => {
        const next = [...prev, text]
        return next.slice(-3) // keep last 3
      })
    }

    console.log = (...args: any[]) => { push('›', args); previous.log(...args) }
    console.error = (...args: any[]) => { push('×', args); previous.error(...args) }
    console.warn = (...args: any[]) => { push('!', args); previous.warn(...args) }

    return () => {
      // Restore captured originals
      if (prevRef.current) {
        console.log = prevRef.current.log
        console.error = prevRef.current.error
        console.warn = prevRef.current.warn
      }
    }
  }, [])

  // Auto-scroll to newest content
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } catch {
      el.scrollTop = el.scrollHeight
    }
  }, [lines])

  const renderLine = (l: string, i: number) => {
    const parts = l.split(/(https?:\/\/[^\s]+)/g)
    return (
      <div key={i} className="console-line">
        {parts.map((p, idx) => {
          if (/^https?:\/\//.test(p)) {
            return (
              <a key={idx} href={p} target="_blank" rel="noreferrer" className="underline">
                {p}
              </a>
            )
          }
          return <span key={idx}>{p}</span>
        })}
      </div>
    )
  }

  return (
    <div className="console-overlay">
      <div ref={containerRef} className="console-bezel">
        {lines.length === 0 ? (
          <div className="console-line dim">Console ready…</div>
        ) : (
          lines.map(renderLine)
        )}
      </div>
    </div>
  )
}

