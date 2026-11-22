import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand">
            Sheba<em style={{ color: '#0f9f8a', fontStyle: 'normal' }}>.</em>
          </div>
          <p>
            Medicines from neighborhood pharmacies you already know — delivered
            fast across Dhaka, with prescription support and COD.
          </p>
        </div>
        <div>
          <h4>Order</h4>
          <Link to="/search">Find medicines</Link>
          <Link to="/prescription">Upload prescription</Link>
          <Link to="/orders">Track orders</Link>
        </div>
        <div>
          <h4>Why Sheba</h4>
          <p>Partner pharmacies, not warehouses</p>
          <p>Under-the-hour delivery targets</p>
          <p>bKash / Nagad / COD — no PIN sharing</p>
        </div>
        <div>
          <h4>Support</h4>
          <p>Helpline 09678-SHEBA</p>
          <p>Bangla & English</p>
          <Link to="/profile">Account & addresses</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Sheba Health Commerce Ltd.</span>
        <span>Built for Bangladesh · Genuine partners · Family-first ordering</span>
      </div>
    </footer>
  )
}
