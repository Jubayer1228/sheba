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
import { LocationPicker } from './LocationPicker'

export function Header() {
  const navigate = useNavigate()
  const location = useLocationStore()
  const user = useAuthStore((s) => s.user)
  const count = useCartStore((s) => s.itemCount())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')

  return (
    <>
      <header className="site-header">
        <div className="header-top">
          <Link to="/" className="brand" aria-label="Sheba home">
            <span className="brand-mark">✚</span>
            <span>
              Sheba<em>.</em>
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
            <Search size={18} color="#5b6b7c" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Napa, Seclo, Lazz Pharma…"
              aria-label="Search medicines or pharmacies"
            />
          </form>

          <div className="header-actions">
            <button
              type="button"
              className="location-chip"
              onClick={() => setPickerOpen(true)}
            >
              <MapPin size={15} color="#0f9f8a" />
              <span>{location.label}</span>
              <ChevronDown size={14} />
            </button>

            <NavLink to="/consult" className="nav-link">
              <Stethoscope size={16} />
              <span className="nav-link-label">Care</span>
            </NavLink>
            <NavLink to="/prescription" className="nav-link">
              <FileText size={16} />
              <span className="nav-link-label">Rx</span>
            </NavLink>
            <NavLink to="/orders" className="nav-link">
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

        <div className="header-sub">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Pharmacies near you
          </NavLink>
          <NavLink
            to="/register"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Join Sheba
          </NavLink>
          <NavLink
            to="/search?q=paracetamol"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Fever & pain
          </NavLink>
          <NavLink
            to="/search?q=diabetes"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Chronic care
          </NavLink>
          <NavLink
            to="/doctors"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Find doctors
          </NavLink>
          <NavLink
            to="/voice"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Voice nurse call
          </NavLink>
          <NavLink
            to="/consult"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Live chat agent
          </NavLink>
          <NavLink
            to="/appointments"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Appointments
          </NavLink>
          <NavLink
            to="/doctor"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Doctor desk
          </NavLink>
          <NavLink
            to="/prescription"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Upload prescription
          </NavLink>
          <button
            type="button"
            className="nav-link"
            onClick={() => {
              /* filter via home query param handled on home when hash used */
              navigate('/?night=1')
            }}
          >
            Late-night open
          </button>
        </div>
      </header>

      {pickerOpen ? <LocationPicker onClose={() => setPickerOpen(false)} /> : null}
    </>
  )
}
