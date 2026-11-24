import { Link } from 'react-router-dom'
import type { Banner } from '../types'
import { uploadUrl } from '../lib/uploadUrl'

const fallback: Banner[] = [
  {
    id: 0,
    title: 'Prescription to doorstep',
    subtitle: 'Upload an Rx photo — a licensed partner pharmacy confirms your cart',
    link_url: '/prescription',
    image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200&q=80',
    sort_order: 0,
    is_active: true,
  },
]

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const list = banners.length ? banners : fallback

  return (
    <div className="banner-track" aria-label="Promotions">
      {list.map((b) => {
        const image = uploadUrl(b.image_url)
        const style = image
          ? {
              backgroundImage: `linear-gradient(118deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.35) 45%, rgba(13, 148, 136, 0.25) 100%), url(${image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined

        const inner = (
          <>
            <span className="banner-eyebrow">Sheba partner network</span>
            <h3>{b.title}</h3>
            <p>{b.subtitle}</p>
          </>
        )

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