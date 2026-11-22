import { Link } from 'react-router-dom'
import type { Banner } from '../types'
import { uploadUrl } from '../lib/uploadUrl'

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  if (!banners.length) {
    return (
      <div className="banner-track">
        <div className="banner-card">
          <h3>Medicines at your door</h3>
          <p>Trusted pharmacies near you — order in minutes.</p>
        </div>
        <div className="banner-card">
          <h3>Upload prescription</h3>
          <p>Send Rx and let a pharmacy prepare your order.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="banner-track">
      {banners.map((b) => {
        const inner = (
          <>
            <h3>{b.title}</h3>
            <p>{b.subtitle}</p>
          </>
        )
        const style = b.image_url
          ? {
              backgroundImage: `linear-gradient(120deg, rgba(215,15,100,0.88), rgba(0,0,0,0.35)), url(${uploadUrl(b.image_url)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined

        if (b.link_url) {
          return (
            <Link key={b.id} to={b.link_url} className="banner-card" style={style}>
              {inner}
            </Link>
          )
        }
        return (
          <div key={b.id} className="banner-card" style={style}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
