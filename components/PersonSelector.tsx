'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PEOPLE = [
  { name: 'Mahesh',   href: '/view/mahesh'   },
  { name: 'Ashutosh', href: '/view/ashutosh' },
  { name: 'Anurag',   href: '/view/anurag'   },
  { name: 'Tanishq',  href: '/view/tanishq'  },
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
            className={`px-5 py-1.5 rounded-lg text-sm font-medium border transition-all select-none
              ${active
                ? 'border-mh-vermillion text-mh-vermillion bg-mh-surface'
                : 'border-mh-border text-mh-muted bg-mh-surface hover:border-mh-vermillion hover:text-mh-text'
              }`}
          >
            {p.name}
          </Link>
        )
      })}
    </div>
  )
}
