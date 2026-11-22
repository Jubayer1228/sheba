export type UserRole = 'customer' | 'pharmacy' | 'admin' | 'rider' | 'ambulance' | 'doctor'

export interface User {
  id: number
  created_at: string
  updated_at: string
  name: string
  email: string
  phone: string
  role: UserRole
  avatar_url: string
  addresses?: Address[]
}

export interface Address {
  id: number
  created_at: string
  user_id: number
  label: string
  line1: string
  area: string
  city: string
  postal_code: string
  latitude: number
  longitude: number
  is_default: boolean
}

export interface Pharmacy {
  id: number
  created_at: string
  updated_at: string
  name: string
  slug: string
  description: string
  image_url: string
  cover_url: string
  phone: string
  address: string
  area: string
  city: string
  latitude: number
  longitude: number
  rating: number
  review_count: number
  delivery_fee: number
  min_order: number
  delivery_minutes: number
  is_open: boolean
  accepts_rx: boolean
  has_pickup: boolean
  has_delivery: boolean
  tags: string
  owner_id?: number
  medicines?: Medicine[]
  distance_km?: number
}

export interface Category {
  id: number
  created_at: string
  name: string
  slug: string
  icon: string
  image_url: string
  sort_order: number
  description: string
}

export interface Medicine {
  id: number
  created_at: string
  updated_at: string
  pharmacy_id: number
  category_id: number
  name: string
  generic_name: string
  brand: string
  description: string
  image_url: string
  strength: string
  form: string
  pack_size: string
  price: number
  discount_pct: number
  stock: number
  requires_rx: boolean
  is_featured: boolean
  manufacturer: string
  pharmacy?: Pharmacy
  category?: Category
  effective_price: number
}

export type PrescriptionStatus = 'pending' | 'verified' | 'rejected' | 'fulfilled'

export interface PrescriptionItem {
  id: number
  prescription_id: number
  medicine_name: string
  generic_name: string
  strength: string
  dosage: string
  duration: string
  quantity: number
  instructions: string
  medicine_id?: number
}

export interface Prescription {
  id: number
  created_at: string
  updated_at: string
  user_id: number
  pharmacy_id?: number
  file_url: string
  file_name: string
  notes: string
  patient_name: string
  doctor_name: string
  status: PrescriptionStatus
  reject_reason?: string
  order_id?: number
  source?: 'upload' | 'doctor' | string
  consultation_id?: number
  doctor_user_id?: number
  pharmacy?: Pharmacy
  items?: PrescriptionItem[]
}

export interface DoctorProfile {
  id: number
  user_id: number
  specialty: string
  specialty_bn: string
  bmdc_number: string
  bio: string
  is_free_consult: boolean
  consult_fee: number
  years_exp: number
  languages: string
  is_available: boolean
  rating: number
  user?: User
}

export type ConsultStatus =
  | 'active'
  | 'matched'
  | 'in_review'
  | 'prescribed'
  | 'completed'
  | 'cancelled'

export interface ConsultMessage {
  id: number
  created_at: string
  consultation_id: number
  role: 'patient' | 'agent' | 'doctor' | string
  content: string
  lang: string
  is_voice: boolean
}

export interface Consultation {
  id: number
  created_at: string
  updated_at: string
  patient_id: number
  doctor_id?: number
  status: ConsultStatus
  preferred_paid?: boolean
  suggested_specialty: string
  summary_bn: string
  summary_en: string
  symptoms_json: string
  match_reason: string
  prescription_id?: number
  patient?: User
  doctor?: User
  doctor_profile?: DoctorProfile
  messages?: ConsultMessage[]
}

export type AppointmentMode = 'video' | 'phone' | 'chat'
export type AppointmentStatus =
  | 'scheduled'
  | 'ready'
  | 'ringing'
  | 'in_call'
  | 'completed'
  | 'cancelled'

export interface DoctorSlot {
  id: number
  doctor_id: number
  starts_at: string
  ends_at: string
  is_booked: boolean
  mode_hint: string
}

export type CallStatus = 'waiting' | 'ringing' | 'active' | 'ended' | 'missed'

export interface CallSession {
  id: number
  created_at: string
  appointment_id: number
  patient_id: number
  doctor_id: number
  mode: AppointmentMode
  status: CallStatus
  started_by: number
  started_at?: string
  answered_at?: string
  ended_at?: string
  patient?: User
  doctor?: User
}

export interface CallSignal {
  id: number
  created_at: string
  call_session_id: number
  from_user_id: number
  kind: 'offer' | 'answer' | 'ice' | 'hangup' | string
  payload: string
}

export interface Appointment {
  id: number
  created_at: string
  updated_at: string
  patient_id: number
  doctor_id: number
  slot_id?: number
  consultation_id?: number
  call_session_id?: number
  mode: AppointmentMode
  status: AppointmentStatus
  scheduled_at: string
  ends_at: string
  reason: string
  reason_bn: string
  fee: number
  is_free: boolean
  is_instant: boolean
  patient?: User
  doctor?: User
  doctor_profile?: DoctorProfile
  call_session?: CallSession
}

export type OrderType = 'delivery' | 'pickup'
export type PaymentMethod = 'cod' | 'bkash' | 'nagad' | 'card'
export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'picked_up'
  | 'cancelled'

export interface OrderItem {
  id: number
  order_id: number
  medicine_id: number
  name: string
  strength: string
  quantity: number
  unit_price: number
  total_price: number
  requires_rx: boolean
  medicine?: Medicine
}

export interface OrderStatusEvent {
  id: number
  created_at: string
  order_id: number
  status: OrderStatus
  note: string
}

export interface Order {
  id: number
  created_at: string
  updated_at: string
  order_number: string
  user_id: number
  pharmacy_id: number
  prescription_id?: number
  type: OrderType
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: string
  subtotal: number
  delivery_fee: number
  discount: number
  total: number
  delivery_address: string
  delivery_area: string
  delivery_city: string
  delivery_lat: number
  delivery_lng: number
  customer_phone: string
  customer_name: string
  notes: string
  estimated_minutes: number
  rider_name?: string
  rider_phone?: string
  rider_lat?: number
  rider_lng?: number
  rider_heading?: number
  rider_speed_kmh?: number
  rider_updated_at?: string
  delivered_at?: string
  items?: OrderItem[]
  pharmacy?: Pharmacy
  user?: User
  status_history?: OrderStatusEvent[]
}

export interface GeoPoint {
  lat: number
  lng: number
}

export interface LiveTracking {
  order_id: number
  order_number: string
  status: OrderStatus
  type: OrderType
  rider_name?: string
  rider_phone?: string
  rider_lat: number
  rider_lng: number
  rider_heading: number
  rider_speed_kmh: number
  rider_updated_at?: string
  pharmacy_name: string
  pharmacy_lat: number
  pharmacy_lng: number
  destination_address: string
  destination_lat: number
  destination_lng: number
  route: GeoPoint[]
  progress: number
  eta_minutes: number
  distance_remaining_km: number
  area_label?: string
  is_live: boolean
}

export interface Banner {
  id: number
  title: string
  subtitle: string
  image_url: string
  link_url: string
  sort_order: number
  is_active: boolean
}

export interface AreaRow {
  area: string
  count: number
}

export interface Review {
  id: number
  created_at: string
  user_id: number
  pharmacy_id: number
  order_id: number
  rating: number
  comment: string
  user?: User
}

export interface AuthPayload {
  token: string
  user: User
}

export interface ApiError {
  error: string
}

export interface CreateOrderPayload {
  pharmacy_id: number
  type: OrderType
  payment_method: PaymentMethod
  items: { medicine_id: number; quantity: number }[]
  prescription_id?: number
  delivery_address?: string
  delivery_area?: string
  delivery_city?: string
  delivery_lat?: number
  delivery_lng?: number
  customer_phone?: string
  customer_name?: string
  notes?: string
}

export interface CreateAddressPayload {
  label?: string
  line1: string
  area?: string
  city?: string
  postal_code?: string
  latitude?: number
  longitude?: number
  is_default?: boolean
}

export interface CartItem {
  medicine: Medicine
  quantity: number
}

export interface LocationState {
  area: string
  city: string
  lat: number
  lng: number
  label: string
}
