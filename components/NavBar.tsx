'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: '排班表' },
  { href: '/employees', label: '員工管理' },
  { href: '/scratch', label: '刮刮樂' },
  { href: '/inventory', label: '庫存管理' },
  { href: '/floor-inventory', label: '現場庫存' },
  { href: '/checkout', label: '結帳表' },
  { href: '/settings', label: '店家設定' },
]

export default function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="bg-amber-400 border-b-4 border-amber-500 shadow-md">
      <div className="max-w-full px-4 flex items-center gap-6 h-14">
        <span className="font-bold text-amber-950 text-lg tracking-wide">彩券行管理</span>
        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                pathname === link.href
                  ? 'bg-amber-950 text-amber-50'
                  : 'text-amber-950 hover:bg-amber-500'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
