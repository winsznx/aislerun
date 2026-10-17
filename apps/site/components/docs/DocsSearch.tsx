'use client'

// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import styles from './docs.module.css'

interface Result {
  id: string
  title: string
  url: string
  snippet: string
}

type SearchState =
  | { status: 'idle' }
  | { status: 'done'; query: string; results: Result[] }
  | { status: 'error'; query: string }

const DEBOUNCE_MS = 140

function pathOf(url: string): string {
  const parsed = new URL(url)
  return `${parsed.pathname}${parsed.hash}`
}

interface DocsSearchProps {
  /** Focus the field when it appears, as in the mobile drawer opened from the search button. */
  autoFocus?: boolean
  /** Listen for the "/" shortcut. Only one search on the page should. */
  shortcut?: boolean
  onNavigate?: () => void
}

export function DocsSearch({ autoFocus = false, shortcut = true, onNavigate }: DocsSearchProps) {
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<AbortController>(undefined)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [state, setState] = useState<SearchState>({ status: 'idle' })

  useEffect(() => {
    if (!shortcut) return
    const focusOnSlash = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]')
      if (event.key !== '/' || typing || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', focusOnSlash)
    return () => window.removeEventListener('keydown', focusOnSlash)
  }, [shortcut])

  const runSearch = (value: string) => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    fetch(`/docs/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search failed with ${response.status}`)
        return response.json() as Promise<{ results: Result[] }>
      })
      .then((body) => {
        setState({ status: 'done', query: value, results: body.results })
        setActive(0)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', query: value })
      })
  }

  const onChange = (value: string) => {
    setQuery(value)
    setOpen(true)
    clearTimeout(timer.current)
    if (value.trim().length < 2) {
      pending.current?.abort()
      setState({ status: 'idle' })
      return
    }
    timer.current = setTimeout(() => runSearch(value.trim()), DEBOUNCE_MS)
  }

  const results = state.status === 'done' ? state.results : []
  const showPanel = open && state.status !== 'idle'

  const go = (result: Result) => {
    setOpen(false)
    onNavigate?.()
    router.push(pathOf(result.url))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!showPanel || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = results[active]
      if (chosen) go(chosen)
    }
  }

  return (
    <div
      className={styles.search}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <label className={styles.searchField}>
        <span className={styles.srOnly}>Search the docs</span>
        <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
        <input
          aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          autoComplete="off"
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search the docs"
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />
        {shortcut ? <kbd aria-hidden="true">/</kbd> : null}
      </label>
      {showPanel ? (
        <div className={styles.searchPanel}>
          {state.status === 'error' ? (
            <p className={styles.searchEmpty} role="status">
              Search isn’t responding. Try again, or browse the sections on the left.
            </p>
          ) : results.length === 0 ? (
            <p className={styles.searchEmpty} role="status">
              Nothing matches “{state.query}”. Try a different word, like savings, rules or fees.
            </p>
          ) : (
            <ul id={listId} role="listbox">
              {results.map((result, index) => (
                <li aria-selected={index === active} id={`${listId}-${index}`} key={result.id} role="option">
                  <Link
                    data-active={index === active}
                    href={pathOf(result.url)}
                    onClick={() => {
                      setOpen(false)
                      onNavigate?.()
                    }}
                    onMouseEnter={() => setActive(index)}
                  >
                    <strong>{result.title}</strong>
                    <span>{result.snippet}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
