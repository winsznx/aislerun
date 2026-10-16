'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { DOC_SECTIONS, docPath } from '../../lib/docs/manifest'
import { DocsSearch } from './DocsSearch'
import { Logo } from '../Logo'
import styles from './docs.module.css'

type Drawer = { path: string; focus: 'search' | 'menu' }

function NavSections({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {DOC_SECTIONS.map((section) => (
        <div className={styles.navSection} key={section.title}>
          <p>{section.title}</p>
          <ul>
            {section.pages.map((page) => {
              const href = docPath(page.slug)
              return (
                <li key={page.slug}>
                  <Link aria-current={pathname === href ? 'page' : undefined} href={href} onClick={onNavigate}>
                    {page.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

/** Header, sidebar and the mobile drawer. The drawer belongs to the page it was opened on, so navigating closes it. */
export function DocsChrome({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const pathname = usePathname()
  const [drawer, setDrawer] = useState<Drawer | null>(null)
  const open = drawer?.path === pathname ? drawer : null
  const close = () => setDrawer(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link aria-label="AisleRun home" href="/">
              <Logo size={24} />
            </Link>
            <Link className={styles.docsMark} href="/docs">
              Docs
            </Link>
          </div>
          <div className={styles.headerSearch}>
            <DocsSearch />
          </div>
          <nav aria-label="Site" className={styles.headerLinks}>
            <Link href="/demo/compare">Before and after</Link>
            <Link className={styles.headerCta} href="/demo">
              See the runs
            </Link>
          </nav>
          <button
            aria-controls="docs-drawer"
            aria-expanded={open?.focus === 'search'}
            aria-label="Search the docs"
            className={styles.iconButton}
            onClick={() => setDrawer({ path: pathname, focus: 'search' })}
            type="button"
          >
            <SearchIcon />
          </button>
          <button
            aria-controls="docs-drawer"
            aria-expanded={Boolean(open)}
            aria-label="Open the docs menu"
            className={styles.iconButton}
            onClick={() => setDrawer({ path: pathname, focus: 'menu' })}
            type="button"
          >
            <MenuIcon />
          </button>
        </div>
      </header>
      <div className={styles.frame}>
        <nav aria-label="Docs" className={styles.sidebar}>
          <NavSections pathname={pathname} />
        </nav>
        <main className={styles.main} id="main">
          {children}
          {footer}
        </main>
      </div>
      {open ? (
        <div className={styles.drawerLayer}>
          <button aria-label="Close the docs menu" className={styles.backdrop} onClick={close} tabIndex={-1} type="button" />
          <div aria-label="Docs menu" aria-modal="true" className={styles.drawer} id="docs-drawer" role="dialog">
            <div className={styles.drawerHead}>
              <Link aria-label="AisleRun home" href="/" onClick={close}>
                <Logo size={22} />
              </Link>
              <button aria-label="Close the docs menu" autoFocus={open.focus === 'menu'} className={`${styles.iconButton} ${styles.drawerClose}`} onClick={close} type="button">
                <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
            <div className={styles.drawerSearch}>
              <DocsSearch autoFocus={open.focus === 'search'} onNavigate={close} shortcut={false} />
            </div>
            <nav aria-label="Docs" className={styles.drawerNav}>
              <NavSections onNavigate={close} pathname={pathname} />
            </nav>
            <div className={styles.drawerLinks}>
              <Link href="/demo" onClick={close}>
                Published runs
              </Link>
              <Link href="/demo/compare" onClick={close}>
                Before and after
              </Link>
              <Link className={styles.headerCta} href="/demo" onClick={close}>
                See the runs
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
