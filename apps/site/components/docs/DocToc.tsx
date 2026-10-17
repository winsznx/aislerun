'use client'

// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.

import { useEffect, useState } from 'react'
import type { DocHeading } from '../../lib/docs/markdown'
import styles from './docs.module.css'

/** Distance below the sticky header where a heading counts as the one being read. */
const READING_LINE = 120

export function DocToc({ headings }: { headings: readonly DocHeading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? '')

  useEffect(() => {
    const elements = headings.map((heading) => document.getElementById(heading.id)).filter((element): element is HTMLElement => element !== null)
    let frame = 0
    const update = () => {
      frame = 0
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      const passed = elements.filter((element) => element.getBoundingClientRect().top <= READING_LINE)
      const current = atBottom ? elements[elements.length - 1] : passed[passed.length - 1]
      setActive(current?.id ?? elements[0]?.id ?? '')
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [headings])

  return (
    <aside aria-label="On this page" className={styles.toc}>
      <p>On this page</p>
      <ul>
        {headings.map((heading) => (
          <li className={heading.depth === 3 ? styles.tocDeep : undefined} key={heading.id}>
            <a aria-current={heading.id === active ? 'true' : undefined} href={`#${heading.id}`}>
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
