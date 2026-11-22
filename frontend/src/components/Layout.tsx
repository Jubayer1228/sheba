import { Outlet, useLocation } from 'react-router-dom'
import { AuthHeader } from './AuthHeader'
import { CartBar } from './CartBar'
import { Footer } from './Footer'
import { Header } from './Header'

const AUTH_PREFIXES = ['/login', '/register']

export function Layout() {
  const { pathname } = useLocation()
  const isAuth = AUTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  const isRegister = pathname === '/register' || pathname.startsWith('/register/')
  const isCallRoom = pathname.startsWith('/calls/') || pathname === '/voice'

  return (
    <div
      className={`app-shell${isRegister ? ' register-shell' : ''}${isCallRoom ? ' call-shell' : ''}`}
    >
      {isCallRoom ? null : isRegister ? <AuthHeader /> : !isAuth ? <Header /> : null}
      <Outlet />
      {!isAuth && !isCallRoom ? (
        <>
          <CartBar />
          <Footer />
        </>
      ) : null}
    </div>
  )
}
