import { Minus, Plus } from 'lucide-react'

export function QuantityControl({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="qty-ctrl">
      <button type="button" aria-label="Decrease" onClick={() => onChange(value - 1)}>
        <Minus size={14} />
      </button>
      <span>{value}</span>
      <button type="button" aria-label="Increase" onClick={() => onChange(value + 1)}>
        <Plus size={14} />
      </button>
    </div>
  )
}
