import { FileText, Home, Package, Search, ShoppingBag } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useCartStore } from '../stores/cartStore'

const links = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/prescription', label: 'Rx', icon: FileText },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/cart', label: 'Cart', icon: ShoppingBag },
]

export function BottomNav() {
  const count = useCartStore((s) => s.itemCount())

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          <span style={{ position: 'relative' }}>
            <Icon size={20} />
            {to === '/cart' && count > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -10,
                  background: '#D70F64',
                  color: 'white',
                  borderRadius: 999,
                  fontSize: 10,
                  minWidth: 16,
                  height: 16,
                  display: 'grid',
                  placeItems: 'center',
                  padding: '0 3px',
                  fontWeight: 800,
                }}
              >
                {count}
              </span>
            ) : null}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
