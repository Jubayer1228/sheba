import { Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/** Compact register-flow chrome — language + Register + green search (AllSamadhan-inspired, fixed alignment). */
export function AuthHeader() {
  const navigate = useNavigate()
  const [lang, setLang] = useState<'bn' | 'en'>('en')
  const [q, setQ] = useState('')

  return (
    <header className="auth-chrome">
      <div className="auth-chrome-top">
        <Link to="/" className="brand auth-brand">
          <span className="brand-mark">✚</span>
          <span>
            Sheba<em>.</em>
          </span>
        </Link>

        <div className="auth-chrome-actions">
          <div className="lang-toggle" role="group" aria-label="Language">
            <button
              type="button"
              className={lang === 'bn' ? 'active' : ''}
              onClick={() => setLang('bn')}
            >
              বাংলা
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'active' : ''}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>

          <Link to="/register" className="register-chip">
            <UserPlus size={16} />
            Register
          </Link>
        </div>
      </div>

      <div className="auth-search-bar">
        <form
          className="auth-search-inner"
          onSubmit={(e) => {
            e.preventDefault()
            const query = q.trim()
            navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'ওষুধ বা ফার্মেসি খুঁজুন…'
                : 'Search medicines or pharmacies…'
            }
            aria-label="Search"
          />
          <button type="submit" className="auth-search-btn" aria-label="Search">
            <Search size={18} />
          </button>
        </form>
      </div>
    </header>
  )
}
