import type {
  Address,
  Appointment,
  AppointmentMode,
  AreaRow,
  AuthPayload,
  Banner,
  CallSession,
  CallSignal,
  Category,
  Consultation,
  CreateAddressPayload,
  CreateOrderPayload,
  DoctorProfile,
  DoctorSlot,
  LiveTracking,
  Medicine,
  Order,
  Pharmacy,
  Prescription,
  Review,
  User,
} from '../types'
import { api, unwrap } from './client'

export const authApi = {
  register: (body: { name: string; email: string; phone: string; password: string }) =>
    api.post<{ data: AuthPayload }>('/auth/register', body).then(unwrap),
  login: (body: { email: string; password: string }) =>
    api.post<{ data: AuthPayload }>('/auth/login', body).then(unwrap),
  me: () => api.get<{ data: User }>('/me').then(unwrap),
  updateMe: (body: { name?: string; phone?: string }) =>
    api.patch<{ data: User }>('/me', body).then(unwrap),
}

export const addressApi = {
  list: () => api.get<{ data: Address[] }>('/addresses').then(unwrap),
  create: (body: CreateAddressPayload) =>
    api.post<{ data: Address }>('/addresses', body).then(unwrap),
  remove: (id: number) =>
    api.delete<{ data: { deleted: boolean } }>(`/addresses/${id}`).then(unwrap),
}

export type PharmacyQuery = {
  lat?: number
  lng?: number
  area?: string
  city?: string
  q?: string
  sort?: 'distance' | 'rating' | 'delivery_fee' | 'fastest'
  open?: boolean
  rx?: boolean
}

export const pharmacyApi = {
  list: (params: PharmacyQuery = {}) => {
    const q: Record<string, string | number> = {}
    if (params.lat != null) q.lat = params.lat
    if (params.lng != null) q.lng = params.lng
    if (params.area) q.area = params.area
    if (params.city) q.city = params.city
    if (params.q) q.q = params.q
    if (params.sort) q.sort = params.sort
    if (params.open) q.open = 1
    if (params.rx) q.rx = 1
    return api.get<{ data: Pharmacy[] }>('/pharmacies', { params: q }).then(unwrap)
  },
  get: (id: number | string, coords?: { lat: number; lng: number }) =>
    api
      .get<{ data: Pharmacy }>(`/pharmacies/${id}`, {
        params: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
      })
      .then(unwrap),
  medicines: (
    id: number | string,
    params: { category_id?: number; q?: string; rx?: boolean } = {},
  ) => {
    const q: Record<string, string | number> = {}
    if (params.category_id) q.category_id = params.category_id
    if (params.q) q.q = params.q
    if (params.rx) q.rx = 1
    return api
      .get<{ data: Medicine[] }>(`/pharmacies/${id}/medicines`, { params: q })
      .then(unwrap)
  },
}

export const catalogApi = {
  categories: () => api.get<{ data: Category[] }>('/categories').then(unwrap),
  category: (slug: string) =>
    api
      .get<{ data: { category: Category; medicine_count: number } }>(`/categories/${slug}`)
      .then(unwrap),
  categoryMedicines: (
    slug: string,
    params: { q?: string; sort?: string; rx?: boolean; limit?: number } = {},
  ) => {
    const q: Record<string, string | number> = {}
    if (params.q) q.q = params.q
    if (params.sort) q.sort = params.sort
    if (params.rx) q.rx = 1
    if (params.limit) q.limit = params.limit
    return api
      .get<{ data: { category: Category; medicines: Medicine[] } }>(
        `/categories/${slug}/medicines`,
        { params: q },
      )
      .then(unwrap)
  },
  banners: () => api.get<{ data: Banner[] }>('/banners').then(unwrap),
  areas: (city = 'Dhaka') =>
    api.get<{ data: AreaRow[] }>('/areas', { params: { city } }).then(unwrap),
  searchMedicines: (q: string, coords?: { lat: number; lng: number }) =>
    api
      .get<{ data: Medicine[] }>('/medicines/search', {
        params: { q, ...(coords ?? {}) },
      })
      .then(unwrap),
  featured: () => api.get<{ data: Medicine[] }>('/medicines/featured').then(unwrap),
  medicine: (id: number | string) =>
    api.get<{ data: Medicine }>(`/medicines/${id}`).then(unwrap),
}

export const partnerApi = {
  registerPharmacy: (body: Record<string, unknown>) =>
    api
      .post<{
        data: AuthPayload & {
          pharmacy: Pharmacy
          application: unknown
          message: string
        }
      }>('/partners/pharmacy', body)
      .then(unwrap),
  registerRider: (body: Record<string, unknown>) =>
    api
      .post<{ data: AuthPayload & { application: unknown; message: string } }>(
        '/partners/rider',
        body,
      )
      .then(unwrap),
  registerAmbulance: (body: Record<string, unknown>) =>
    api
      .post<{ data: AuthPayload & { application: unknown; message: string } }>(
        '/partners/ambulance',
        body,
      )
      .then(unwrap),
  registerDoctor: (body: Record<string, unknown>) =>
    api
      .post<{
        data: AuthPayload & { profile: DoctorProfile; application: unknown; message: string }
      }>('/partners/doctor', body)
      .then(unwrap),
  list: (type?: string) =>
    api
      .get<{ data: unknown[] }>('/partners', { params: type ? { type } : undefined })
      .then(unwrap),
}

export const doctorApi = {
  list: (params: { specialty?: string; free?: boolean; paid?: boolean } = {}) => {
    const q: Record<string, string | number> = {}
    if (params.specialty) q.specialty = params.specialty
    if (params.free) q.free = 1
    if (params.paid) q.paid = 1
    return api.get<{ data: DoctorProfile[] }>('/doctors', { params: q }).then(unwrap)
  },
  get: (id: number | string) =>
    api
      .get<{ data: { profile: DoctorProfile; open_slots: number } }>(`/doctors/${id}`)
      .then(unwrap),
  slots: (id: number | string, date?: string) =>
    api
      .get<{ data: DoctorSlot[] }>(`/doctors/${id}/slots`, {
        params: date ? { date } : undefined,
      })
      .then(unwrap),
  inbox: () =>
    api
      .get<{
        data: { assigned: Consultation[]; open: Consultation[]; profile: DoctorProfile }
      }>('/doctor/inbox')
      .then(unwrap),
  profile: () => api.get<{ data: DoctorProfile }>('/doctor/profile').then(unwrap),
  incoming: () =>
    api
      .get<{ data: { calls: CallSession[]; appointments: Appointment[] } }>('/doctor/incoming')
      .then(unwrap),
}

export const appointmentApi = {
  book: (body: {
    doctor_id: number
    slot_id?: number
    scheduled_at?: string
    mode?: AppointmentMode
    reason?: string
    reason_bn?: string
    consultation_id?: number
    instant?: boolean
  }) => api.post<{ data: Appointment }>('/appointments', body).then(unwrap),
  list: (status?: string) =>
    api
      .get<{ data: Appointment[] }>('/appointments', {
        params: status ? { status } : undefined,
      })
      .then(unwrap),
  get: (id: number | string) =>
    api.get<{ data: Appointment }>(`/appointments/${id}`).then(unwrap),
  cancel: (id: number | string) =>
    api.post<{ data: Appointment }>(`/appointments/${id}/cancel`).then(unwrap),
  startCall: (id: number | string) =>
    api
      .post<{ data: { appointment: Appointment; call: CallSession } }>(
        `/appointments/${id}/start-call`,
      )
      .then(unwrap),
}

export const callApi = {
  get: (id: number | string) =>
    api
      .get<{ data: { call: CallSession; appointment: Appointment } }>(`/calls/${id}`)
      .then(unwrap),
  answer: (id: number | string) =>
    api.post<{ data: CallSession }>(`/calls/${id}/answer`).then(unwrap),
  end: (id: number | string) =>
    api.post<{ data: CallSession }>(`/calls/${id}/end`).then(unwrap),
  postSignal: (id: number | string, body: { kind: string; payload: string }) =>
    api.post<{ data: CallSignal }>(`/calls/${id}/signals`, body).then(unwrap),
  signals: (id: number | string, afterId = 0) =>
    api
      .get<{ data: CallSignal[] }>(`/calls/${id}/signals`, {
        params: afterId ? { after_id: afterId } : undefined,
      })
      .then(unwrap),
}

export type ConsultPayload = {
  consultation: Consultation
  prescription?: Prescription
}

function normalizeConsult(data: Consultation | ConsultPayload): ConsultPayload {
  if (data && typeof data === 'object' && 'consultation' in data) {
    return data as ConsultPayload
  }
  return { consultation: data as Consultation }
}

export const voiceApi = {
  status: () =>
    api
      .get<{ data: { llm: boolean; deepgram: boolean; model: string; stt_language: string; tts_model: string } }>(
        '/voice/status',
      )
      .then(unwrap),
  speak: (text: string) =>
    api
      .post<{ data: { audio_b64: string; mime: string } }>('/voice/speak', { text })
      .then(unwrap),
  turn: (form: FormData) =>
    api
      .post<{
        data: {
          consultation: Consultation
          transcript: string
          reply_bn: string
          reply_en: string
          specialty: string
          ready: boolean
          source: string
          audio_b64?: string
          audio_mime?: string
        }
      }>('/voice/turn', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(unwrap),
}

export const consultApi = {
  start: () =>
    api.post<{ data: Consultation | ConsultPayload }>('/consultations').then((r) =>
      normalizeConsult(unwrap(r)),
    ),
  list: () => api.get<{ data: Consultation[] }>('/consultations').then(unwrap),
  get: (id: number | string) =>
    api.get<{ data: Consultation | ConsultPayload }>(`/consultations/${id}`).then((r) =>
      normalizeConsult(unwrap(r)),
    ),
  message: (id: number | string, body: { content: string; lang?: string; is_voice?: boolean }) =>
    api
      .post<{ data: Consultation | ConsultPayload }>(`/consultations/${id}/messages`, body)
      .then((r) => normalizeConsult(unwrap(r))),
  match: (
    id: number | string,
    body: { prefer_paid?: boolean; specialty?: string; doctor_id?: number } = {},
  ) =>
    api
      .post<{ data: Consultation | ConsultPayload }>(`/consultations/${id}/match`, body)
      .then((r) => normalizeConsult(unwrap(r))),
  accept: (id: number | string) =>
    api
      .post<{ data: Consultation | ConsultPayload }>(`/consultations/${id}/accept`)
      .then((r) => normalizeConsult(unwrap(r))),
  prescribe: (
    id: number | string,
    body: {
      notes?: string
      items: {
        medicine_name: string
        generic_name?: string
        strength?: string
        dosage?: string
        duration?: string
        quantity?: number
        instructions?: string
      }[]
    },
  ) =>
    api
      .post<{ data: Consultation | ConsultPayload }>(`/consultations/${id}/prescribe`, body)
      .then((r) => normalizeConsult(unwrap(r))),
}

export const prescriptionApi = {
  upload: (form: FormData) =>
    api.post<{ data: Prescription }>('/prescriptions', form).then(unwrap),
  list: () => api.get<{ data: Prescription[] }>('/prescriptions').then(unwrap),
  get: (id: number | string) =>
    api.get<{ data: Prescription }>(`/prescriptions/${id}`).then(unwrap),
  assignPharmacy: (id: number | string, pharmacy_id: number) =>
    api
      .patch<{ data: Prescription }>(`/prescriptions/${id}/pharmacy`, { pharmacy_id })
      .then(unwrap),
  orderFromRx: (
    id: number | string,
    body: {
      pharmacy_id: number
      type?: string
      payment_method?: string
      delivery_address?: string
      delivery_area?: string
      delivery_city?: string
      delivery_lat?: number
      delivery_lng?: number
      customer_phone?: string
      customer_name?: string
      notes?: string
    },
  ) =>
    api
      .post<{ data: { order: Order; missing_medicines?: string[] } }>(
        `/prescriptions/${id}/order`,
        body,
      )
      .then(unwrap),
}

export const orderApi = {
  create: (body: CreateOrderPayload) =>
    api.post<{ data: Order }>('/orders', body).then(unwrap),
  list: () => api.get<{ data: Order[] }>('/orders').then(unwrap),
  get: (id: number | string) =>
    api.get<{ data: Order }>(`/orders/${id}`).then(unwrap),
  tracking: (id: number | string) =>
    api.get<{ data: LiveTracking }>(`/orders/${id}/tracking`).then(unwrap),
  cancel: (id: number | string) =>
    api.post<{ data: Order }>(`/orders/${id}/cancel`).then(unwrap),
  complete: (id: number | string) =>
    api.post<{ data: Order }>(`/orders/${id}/complete`).then(unwrap),
  review: (body: {
    pharmacy_id: number
    order_id: number
    rating: number
    comment?: string
  }) => api.post<{ data: Review }>('/reviews', body).then(unwrap),
}
