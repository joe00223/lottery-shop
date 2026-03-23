'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/', label: '排班表' },
  { href: '/employees', label: '員工管理' },
  { href: '/scratch', label: '刮刮樂' },
  { href: '/inventory', label: '庫存管理' },
  { href: '/floor-inventory', label: '現場庫存' },
  { href: '/checkout', label: '結帳表' },
  { href: '/monthly', label: '月報表' },
  { href: '/settings', label: '店家設定' },
]

export default function NavBar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const linkClass = (href: string) =>
    `block px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
      pathname === href
        ? 'bg-amber-950 text-amber-50'
        : 'text-amber-950 hover:bg-amber-500'
    }`

  return (
    <nav className="bg-amber-400 border-b-4 border-amber-500 shadow-md">
      <div className="max-w-full px-4 flex items-center h-14">
        <span className="font-bold text-amber-950 text-lg tracking-wide shrink-0">彩券行管理</span>

        {/* Desktop links */}
        <div className="hidden md:flex gap-1 ml-4 flex-wrap">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Logout — desktop */}
        <button onClick={logout} className="hidden md:block ml-auto text-sm font-medium text-amber-950 hover:bg-amber-500 px-3 py-2 rounded-md transition-colors">
          登出
        </button>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto flex flex-col gap-1.5 p-2 rounded-lg hover:bg-amber-500 transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label="選單"
        >
          <span className={`block w-6 h-0.5 bg-amber-950 transition-transform duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block w-6 h-0.5 bg-amber-950 transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-amber-950 transition-transform duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-amber-300 border-t-2 border-amber-500 px-4 py-3 flex flex-col gap-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <button onClick={logout} className="text-left px-4 py-2 rounded-md text-sm font-semibold text-amber-950 hover:bg-amber-500 transition-colors mt-1">
            登出
          </button>
        </div>
      )}
    </nav>
  )
}
