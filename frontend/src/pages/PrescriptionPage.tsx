import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { pharmacyApi, prescriptionApi } from '../api/endpoints'
import { EmptyState } from '../components/EmptyState'
import { PharmacyCard } from '../components/PharmacyCard'
import { Spinner } from '../components/Spinner'
import { relativeTime } from '../lib/format'
import { uploadUrl } from '../lib/uploadUrl'
import { useCartStore } from '../stores/cartStore'
import { useLocationStore } from '../stores/locationStore'

export function PrescriptionPage() {
  const queryClient = useQueryClient()
  const { lat, lng, city, area } = useLocationStore()
  const setPrescriptionId = useCartStore((s) => s.setPrescriptionId)
  const cartPharmacy = useCartStore((s) => s.pharmacy)

  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [patientName, setPatientName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [pharmacyId, setPharmacyId] = useState<number | ''>(
    cartPharmacy?.id ?? '',
  )
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const listQ = useQuery({
    queryKey: ['prescriptions'],
    queryFn: prescriptionApi.list,
  })

  const pharmaciesQ = useQuery({
    queryKey: ['rx-pharmacies', lat, lng, city, area],
    queryFn: () =>
      pharmacyApi.list({ lat, lng, city, area, rx: true, open: true, sort: 'distance' }),
  })

  const upload = useMutation({
    mutationFn: (form: FormData) => prescriptionApi.upload(form),
    onSuccess: (rx) => {
      setMessage(`Prescription uploaded (#${rx.id})`)
      setError('')
      setFile(null)
      setNotes('')
      setPrescriptionId(rx.id)
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] })
    },
    onError: (err: Error) => {
      setError(err.message)
      setMessage('')
    },
  })

  const assign = useMutation({
    mutationFn: ({ id, pharmacy_id }: { id: number; pharmacy_id: number }) =>
      prescriptionApi.assignPharmacy(id, pharmacy_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] })
    },
  })

  function onUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Please choose a prescription file')
      return
    }
    const form = new FormData()
    form.append('file', file)
    if (notes) form.append('notes', notes)
    if (patientName) form.append('patient_name', patientName)
    if (doctorName) form.append('doctor_name', doctorName)
    if (pharmacyId) form.append('pharmacy_id', String(pharmacyId))
    upload.mutate(form)
  }

  return (
    <main className="page">
      <h1 style={{ fontSize: '1.35rem', marginBottom: 4 }}>Prescription</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Upload Rx photo or PDF, then pick a pharmacy that accepts prescriptions.
      </p>

      <form className="card-panel" onSubmit={onUpload}>
        <div className="field">
          <label htmlFor="rxfile">Prescription file</label>
          <label
            htmlFor="rxfile"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              border: '2px dashed #e8e8e8',
              borderRadius: 14,
              padding: 24,
              cursor: 'pointer',
              background: '#fafafa',
            }}
          >
            <Upload size={28} color="#D70F64" />
            <span style={{ fontWeight: 700 }}>
              {file ? file.name : 'Tap to choose JPG, PNG, WEBP or PDF'}
            </span>
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              Max 8MB
            </span>
          </label>
          <input
            id="rxfile"
            className="sr-only"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field">
          <label htmlFor="patient">Patient name</label>
          <input
            id="patient"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="doctor">Doctor name</label>
          <input
            id="doctor"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="rxnotes">Notes</label>
          <textarea
            id="rxnotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferred brands, allergies…"
          />
        </div>
        <div className="field">
          <label htmlFor="rxpharm">Preferred pharmacy (optional)</label>
          <select
            id="rxpharm"
            value={pharmacyId}
            onChange={(e) =>
              setPharmacyId(e.target.value ? Number(e.target.value) : '')
            }
          >
            <option value="">Select later</option>
            {(pharmaciesQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.area}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={upload.isPending}
        >
          <FileUp size={18} />
          {upload.isPending ? 'Uploading…' : 'Upload prescription'}
        </button>
      </form>

      <div className="section-head">
        <h2>Your prescriptions</h2>
      </div>
      {listQ.isLoading ? <Spinner /> : null}
      {!listQ.isLoading && (listQ.data ?? []).length === 0 ? (
        <EmptyState title="No prescriptions yet" description="Upload one to get started." />
      ) : (
        <div className="stack-gap">
          {(listQ.data ?? []).map((rx) => (
            <div key={rx.id} className="card-panel">
              <div className="flex-between">
                <div>
                  <strong>{rx.file_name || `Rx #${rx.id}`}</strong>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {rx.status} · {relativeTime(rx.created_at)}
                  </div>
                  {rx.pharmacy ? (
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Pharmacy: {rx.pharmacy.name}
                    </div>
                  ) : null}
                </div>
                <a
                  className="btn btn-secondary"
                  href={uploadUrl(rx.file_url)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: '8px 12px' }}
                >
                  View
                </a>
              </div>
              {!rx.pharmacy_id ? (
                <div style={{ marginTop: 10 }}>
                  <label className="muted" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    Assign pharmacy
                  </label>
                  <select
                    style={{
                      width: '100%',
                      marginTop: 6,
                      border: '1px solid #e8e8e8',
                      borderRadius: 12,
                      padding: 10,
                    }}
                    defaultValue=""
                    onChange={(e) => {
                      const pid = Number(e.target.value)
                      if (pid) assign.mutate({ id: rx.id, pharmacy_id: pid })
                    }}
                  >
                    <option value="" disabled>
                      Choose pharmacy
                    </option>
                    {(pharmaciesQ.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPrescriptionId(rx.id)}
                  >
                    Use for cart
                  </button>
                  {rx.pharmacy_id ? (
                    <Link
                      to={`/pharmacies/${rx.pharmacy_id}`}
                      className="btn btn-ghost"
                      style={{ marginLeft: 8 }}
                    >
                      Open pharmacy
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="section-head">
        <h2>Pharmacies accepting Rx</h2>
      </div>
      {pharmaciesQ.isLoading ? <Spinner /> : null}
      <div className="pharmacy-grid">
        {(pharmaciesQ.data ?? []).slice(0, 6).map((p) => (
          <PharmacyCard key={p.id} pharmacy={p} />
        ))}
      </div>
    </main>
  )
}
