import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addressApi, authApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { useAuthStore } from '../stores/authStore'
import { useLocationStore } from '../stores/locationStore'

export function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocationStore()

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [profileMsg, setProfileMsg] = useState('')

  const [label, setLabel] = useState('Home')
  const [line1, setLine1] = useState('')
  const [area, setArea] = useState(location.area)
  const [city, setCity] = useState(location.city)
  const [addrError, setAddrError] = useState('')

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !!token,
  })

  const addressesQ = useQuery({
    queryKey: ['addresses'],
    queryFn: addressApi.list,
    enabled: !!token,
  })

  useEffect(() => {
    if (meQ.data) {
      setName(meQ.data.name)
      setPhone(meQ.data.phone)
      setUser(meQ.data)
    }
  }, [meQ.data, setUser])

  const saveProfile = useMutation({
    mutationFn: () => authApi.updateMe({ name, phone }),
    onSuccess: (u) => {
      setUser(u)
      setProfileMsg('Profile updated')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err: Error) => setProfileMsg(err.message),
  })

  const addAddress = useMutation({
    mutationFn: addressApi.create,
    onSuccess: () => {
      setLine1('')
      setAddrError('')
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
    },
    onError: (err: Error) => setAddrError(err.message),
  })

  const removeAddress = useMutation({
    mutationFn: (id: number) => addressApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })

  return (
    <main className="page">
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem' }}>Profile</h1>
          <p className="muted">{user?.email}</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <section className="card-panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Account</h2>
        <div className="field">
          <label htmlFor="pname">Name</label>
          <input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pphone">Phone</label>
          <input id="pphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {profileMsg ? (
          <p className={profileMsg.includes('updated') ? 'success-text' : 'error-text'}>
            {profileMsg}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={saveProfile.isPending}
          onClick={() => saveProfile.mutate()}
        >
          Save profile
        </button>
      </section>

      <section className="card-panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Saved addresses</h2>
        {addressesQ.isLoading ? <Spinner /> : null}
        {!addressesQ.isLoading && (addressesQ.data ?? []).length === 0 ? (
          <EmptyState title="No addresses" description="Add one for faster checkout." />
        ) : (
          <div className="stack-gap" style={{ marginBottom: 14 }}>
            {(addressesQ.data ?? []).map((a) => (
              <div
                key={a.id}
                className="flex-between"
                style={{
                  border: '1px solid #e8e8e8',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div>
                  <strong>
                    {a.label}
                    {a.is_default ? ' · Default' : ''}
                  </strong>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {a.line1}, {a.area}, {a.city}
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Delete address"
                  onClick={() => removeAddress.mutate(a.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ fontSize: '0.95rem', marginBottom: 10 }}>Add address</h3>
        <div className="field">
          <label htmlFor="alabel">Label</label>
          <input id="alabel" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="aline">Address line</label>
          <input
            id="aline"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="House, road"
          />
        </div>
        <div className="field">
          <label htmlFor="aarea">Area</label>
          <input id="aarea" value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acity">City</label>
          <input id="acity" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        {addrError ? <p className="error-text">{addrError}</p> : null}
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={addAddress.isPending || !line1.trim()}
          onClick={() =>
            addAddress.mutate({
              label,
              line1: line1.trim(),
              area,
              city,
              latitude: location.lat,
              longitude: location.lng,
              is_default: (addressesQ.data ?? []).length === 0,
            })
          }
        >
          {addAddress.isPending ? 'Saving…' : 'Save address'}
        </button>
      </section>
    </main>
  )
}
