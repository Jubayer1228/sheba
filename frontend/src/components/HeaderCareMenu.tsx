import { ChevronDown, Mic, MessageCircle, Stethoscope, Video } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/doctors', label: 'Find doctors', icon: Stethoscope },
  { to: '/consult', label: 'Live chat triage', icon: MessageCircle },
  { to: '/voice', label: 'Voice nurse', icon: Mic },
  { to: '/appointments', label: 'Appointments', icon: Video },
]

export function HeaderCareMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="nav-dropdown" ref={ref}>
      <button
        type="button"
        className={`nav-link nav-dropdown-trigger${open ? ' active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Telehealth
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="nav-dropdown-panel" role="menu">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="nav-dropdown-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}