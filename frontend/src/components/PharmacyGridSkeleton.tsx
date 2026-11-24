export function PharmacyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="pharmacy-grid skeleton-grid" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pharmacy-card skeleton-card">
          <div className="skeleton-block skeleton-img" />
          <div className="meta">
            <div className="skeleton-line w-80" />
            <div className="skeleton-line w-55" />
            <div className="skeleton-pills">
              <span className="skeleton-pill" />
              <span className="skeleton-pill" />
              <span className="skeleton-pill" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}