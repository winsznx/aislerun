'use client'

// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.

import { useState } from 'react'
import styles from './docs.module.css'

const RESET_MS = 2000

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => setCopied('copied'))
      .catch(() => setCopied('failed'))
      .finally(() => setTimeout(() => setCopied('idle'), RESET_MS))
  }

  return (
    <button className={styles.copyButton} onClick={copy} type="button">
      <span aria-live="polite">{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Select and copy' : label}</span>
    </button>
  )
}
