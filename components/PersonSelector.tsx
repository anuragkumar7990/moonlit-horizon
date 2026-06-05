'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PEOPLE = [
  { initial: 'M', name: 'Mahesh',   href: '/view/mahesh'   },
  { initial: 'A', name: 'Ashutosh', href: '/view/ashutosh' },
  { initial: 'A', name: 'Anurag',   href: '/view/anurag'   },
  { initial: 'T', name: 'Tanishq',  href: '/view/tanishq'  },
]

export default function PersonSelector() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-2">
      {PEOPLE.map((p) => {
        const active = pathname === p.href
        return (
          <Link
            key={p.href}
            href={p.href}
            title={p.name}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
              border-2 transition-all select-none
              ${active
                ? 'border-mh-vermillion text-mh-vermillion bg-mh-surface'
                : 'border-mh-border text-mh-muted bg-mh-surface hover:border-mh-vermillion hover:text-mh-text'
              }`}
          >
            {p.initial}
          </Link>
        )
      })}
    </div>
  )
}
