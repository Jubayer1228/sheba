import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Medicine, Pharmacy } from '../types'

interface CartState {
  pharmacy: Pharmacy | null
  items: CartItem[]
  prescriptionId: number | null
  addItem: (medicine: Medicine, pharmacy: Pharmacy, qty?: number) => boolean
  setQuantity: (medicineId: number, quantity: number) => void
  removeItem: (medicineId: number) => void
  clear: () => void
  setPrescriptionId: (id: number | null) => void
  itemCount: () => number
  subtotal: () => number
  requiresRx: () => boolean
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      pharmacy: null,
      items: [],
      prescriptionId: null,

      addItem: (medicine, pharmacy, qty = 1) => {
        const state = get()
        if (state.pharmacy && state.pharmacy.id !== pharmacy.id && state.items.length > 0) {
          const ok = window.confirm(
            `Your cart has items from ${state.pharmacy.name}. Clear cart and add from ${pharmacy.name}?`,
          )
          if (!ok) return false
          set({ pharmacy, items: [], prescriptionId: null })
        }

        const current = get()
        const existing = current.items.find((i) => i.medicine.id === medicine.id)
        if (existing) {
          set({
            pharmacy,
            items: current.items.map((i) =>
              i.medicine.id === medicine.id
                ? { ...i, quantity: i.quantity + qty }
                : i,
            ),
          })
        } else {
          set({
            pharmacy,
            items: [...current.items, { medicine, quantity: qty }],
          })
        }
        return true
      },

      setQuantity: (medicineId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(medicineId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.medicine.id === medicineId ? { ...i, quantity } : i,
          ),
        })
      },

      removeItem: (medicineId) => {
        const items = get().items.filter((i) => i.medicine.id !== medicineId)
        set({
          items,
          pharmacy: items.length ? get().pharmacy : null,
          prescriptionId: items.length ? get().prescriptionId : null,
        })
      },

      clear: () => set({ pharmacy: null, items: [], prescriptionId: null }),

      setPrescriptionId: (id) => set({ prescriptionId: id }),

      itemCount: () => get().items.reduce((n, i) => n + i.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => {
          const price = i.medicine.effective_price || i.medicine.price
          return sum + price * i.quantity
        }, 0),

      requiresRx: () => get().items.some((i) => i.medicine.requires_rx),
    }),
    { name: 'sheba-cart' },
  ),
)
