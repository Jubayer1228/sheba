import {
  ChevronDown,
  FileText,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useLocationStore } from '../stores/locationStore'
import { HeaderCareMenu } from './HeaderCareMenu'
import { LocationPicker } from './LocationPicker'

export function Header() {
  const navigate = useNavigate()
  const location = useLocationStore()
  const user = useAuthStore((s) => s.user)
  const count = useCartStore((s) => s.itemCount())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')

  const isDoctor = user?.role === 'doctor'

  return (
    <>
      <header className="site-header">
        <div className="header-top">
          <Link to="/" className="brand" aria-label="Sheba home">
            <span className="brand-mark" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>
              Sheba<span className="brand-dot">.</span>
            </span>
          </Link>

          <form
            className="header-search"
            onSubmit={(e) => {
              e.preventDefault()
              const query = q.trim()
              navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
            }}
          >
            <Search size={18} aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Medicine, brand, or pharmacy name…"
              aria-label="Search medicines or pharmacies"
            />
            <kbd className="search-kbd" aria-hidden>
              ↵
            </kbd>
          </form>

          <div className="header-actions">
            <button
              type="button"
              className="location-chip"
              onClick={() => setPickerOpen(true)}
            >
              <MapPin size={15} />
              <span>{location.label}</span>
              <ChevronDown size={14} />
            </button>

            <NavLink to="/consult" className="nav-link nav-link--accent" title="Health chat">
              <Stethoscope size={16} />
              <span className="nav-link-label">Care</span>
            </NavLink>
            <NavLink to="/prescription" className="nav-link" title="Upload prescription">
              <FileText size={16} />
              <span className="nav-link-label">Rx</span>
            </NavLink>
            <NavLink to="/orders" className="nav-link" title="Your orders">
              <Package size={16} />
              <span className="nav-link-label">Orders</span>
            </NavLink>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cart"
              onClick={() => navigate('/cart')}
            >
              <ShoppingBag size={18} />
              {count > 0 ? <span className="cart-count">{count}</span> : null}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Account"
              onClick={() => navigate(user ? '/profile' : '/login')}
            >
              <UserRound size={18} />
            </button>
          </div>
        </div>

        <nav className="header-sub" aria-label="Browse">
          <NavLink to="/" end className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}>
            Pharmacies
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
          >
            Medicines
          </NavLink>
          <NavLink
            to="/prescription"
            className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
          >
            Upload prescription
          </NavLink>
          <HeaderCareMenu />
          <NavLink
            to="/register"
            className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
          >
            Partner with us
          </NavLink>
          {isDoctor ? (
            <NavLink
              to="/doctor"
              className={({ isActive }) => `nav-pill nav-pill--pro${isActive ? ' active' : ''}`}
            >
              Doctor desk
            </NavLink>
          ) : null}
          <button
            type="button"
            className="nav-pill"
            onClick={() => navigate('/?night=1')}
          >
            Open late night
          </button>
        </nav>
      </header>

      {pickerOpen ? <LocationPicker onClose={() => setPickerOpen(false)} /> : null}
    </>
  )
}