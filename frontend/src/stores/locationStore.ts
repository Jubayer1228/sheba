import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LocationState } from '../types'

interface LocationStore extends LocationState {
  setLocation: (loc: Partial<LocationState>) => void
}

const DEFAULT: LocationState = {
  area: 'Dhanmondi',
  city: 'Dhaka',
  lat: 23.7461,
  lng: 90.3742,
  label: 'Dhanmondi, Dhaka',
}

export const useLocationStore = create<LocationStore>()(
  persist(
    (set) => ({
      ...DEFAULT,
      setLocation: (loc) =>
        set((s) => {
          const next = { ...s, ...loc }
          next.label = `${next.area}, ${next.city}`
          return next
        }),
    }),
    { name: 'sheba-location' },
  ),
)
