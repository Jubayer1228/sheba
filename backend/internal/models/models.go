package models

import (
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	RoleCustomer  UserRole = "customer"
	RolePharmacy  UserRole = "pharmacy"
	RoleAdmin     UserRole = "admin"
	RoleRider     UserRole = "rider"
	RoleAmbulance UserRole = "ambulance"
	RoleDoctor    UserRole = "doctor"
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Name      string         `gorm:"size:120;not null" json:"name"`
	Email     string         `gorm:"size:160;uniqueIndex;not null" json:"email"`
	Phone     string         `gorm:"size:20;index" json:"phone"`
	Password  string         `gorm:"size:255;not null" json:"-"`
	Role      UserRole       `gorm:"size:20;default:customer" json:"role"`
	AvatarURL string         `gorm:"size:500" json:"avatar_url"`
	Addresses []Address      `json:"addresses,omitempty"`
}

type Address struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time `json:"created_at"`
	UserID     uint      `gorm:"index;not null" json:"user_id"`
	Label      string    `gorm:"size:60" json:"label"`
	Line1      string    `gorm:"size:255;not null" json:"line1"`
	Area       string    `gorm:"size:120" json:"area"`
	City       string    `gorm:"size:80;default:Dhaka" json:"city"`
	PostalCode string    `gorm:"size:20" json:"postal_code"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	IsDefault  bool      `gorm:"default:false" json:"is_default"`
}

type Pharmacy struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	Name            string         `gorm:"size:160;not null" json:"name"`
	Slug            string         `gorm:"size:180;uniqueIndex" json:"slug"`
	Description     string         `gorm:"type:text" json:"description"`
	ImageURL        string         `gorm:"size:500" json:"image_url"`
	CoverURL        string         `gorm:"size:500" json:"cover_url"`
	Phone           string         `gorm:"size:20" json:"phone"`
	Address         string         `gorm:"size:255" json:"address"`
	Area            string         `gorm:"size:120;index" json:"area"`
	City            string         `gorm:"size:80;default:Dhaka;index" json:"city"`
	Latitude        float64        `gorm:"index" json:"latitude"`
	Longitude       float64        `gorm:"index" json:"longitude"`
	Rating          float64        `gorm:"default:4.5" json:"rating"`
	ReviewCount     int            `gorm:"default:0" json:"review_count"`
	DeliveryFee     float64        `gorm:"default:49" json:"delivery_fee"`
	MinOrder        float64        `gorm:"default:100" json:"min_order"`
	DeliveryMinutes int            `gorm:"default:35" json:"delivery_minutes"`
	IsOpen          bool           `gorm:"default:true" json:"is_open"`
	AcceptsRx       bool           `gorm:"default:true" json:"accepts_rx"`
	HasPickup       bool           `gorm:"default:true" json:"has_pickup"`
	HasDelivery     bool           `gorm:"default:true" json:"has_delivery"`
	Tags            string         `gorm:"size:255" json:"tags"`
	OwnerID         *uint          `json:"owner_id,omitempty"`
	Medicines       []Medicine     `json:"medicines,omitempty"`
	DistanceKm      float64        `gorm:"-" json:"distance_km,omitempty"`
}

type Category struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Slug        string    `gorm:"size:120;uniqueIndex" json:"slug"`
	Icon        string    `gorm:"size:80" json:"icon"`
	ImageURL    string    `gorm:"size:500" json:"image_url"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	Description string    `gorm:"size:255" json:"description"`
}

type Medicine struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	PharmacyID    uint           `gorm:"index;not null" json:"pharmacy_id"`
	CategoryID    uint           `gorm:"index" json:"category_id"`
	Name          string         `gorm:"size:200;not null;index" json:"name"`
	GenericName   string         `gorm:"size:200;index" json:"generic_name"`
	Brand         string         `gorm:"size:120" json:"brand"`
	Description   string         `gorm:"type:text" json:"description"`
	ImageURL      string         `gorm:"size:500" json:"image_url"`
	Strength      string         `gorm:"size:60" json:"strength"`
	Form          string         `gorm:"size:60" json:"form"` // tablet, syrup, capsule, injection
	PackSize      string         `gorm:"size:60" json:"pack_size"`
	Price         float64        `gorm:"not null" json:"price"`
	DiscountPct   float64        `gorm:"default:0" json:"discount_pct"`
	Stock         int            `gorm:"default:100" json:"stock"`
	RequiresRx    bool           `gorm:"default:false" json:"requires_rx"`
	IsFeatured    bool           `gorm:"default:false" json:"is_featured"`
	Manufacturer  string         `gorm:"size:120" json:"manufacturer"`
	Pharmacy      *Pharmacy      `json:"pharmacy,omitempty"`
	Category      *Category      `json:"category,omitempty"`
	EffectivePrice float64       `gorm:"-" json:"effective_price"`
}

type PrescriptionStatus string

const (
	RxPending   PrescriptionStatus = "pending"
	RxVerified  PrescriptionStatus = "verified"
	RxRejected  PrescriptionStatus = "rejected"
	RxFulfilled PrescriptionStatus = "fulfilled"
)

type Prescription struct {
	ID             uint               `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
	UserID         uint               `gorm:"index;not null" json:"user_id"`
	PharmacyID     *uint              `gorm:"index" json:"pharmacy_id,omitempty"`
	FileURL        string             `gorm:"size:500" json:"file_url"`
	FileName       string             `gorm:"size:255" json:"file_name"`
	Notes          string             `gorm:"type:text" json:"notes"`
	PatientName    string             `gorm:"size:120" json:"patient_name"`
	DoctorName     string             `gorm:"size:120" json:"doctor_name"`
	Status         PrescriptionStatus `gorm:"size:20;default:pending" json:"status"`
	RejectReason   string             `gorm:"size:255" json:"reject_reason,omitempty"`
	OrderID        *uint              `json:"order_id,omitempty"`
	Source         string             `gorm:"size:30;default:upload" json:"source"` // upload | doctor
	ConsultationID *uint              `gorm:"index" json:"consultation_id,omitempty"`
	DoctorUserID   *uint              `gorm:"index" json:"doctor_user_id,omitempty"`
	Pharmacy       *Pharmacy          `json:"pharmacy,omitempty"`
	Items          []PrescriptionItem `json:"items,omitempty"`
}

type OrderType string

const (
	OrderDelivery OrderType = "delivery"
	OrderPickup   OrderType = "pickup"
)

type OrderStatus string

const (
	OrderPlaced             OrderStatus = "placed"
	OrderConfirmed          OrderStatus = "confirmed"
	OrderPreparing          OrderStatus = "preparing"
	OrderReady              OrderStatus = "ready"
	OrderOutForDelivery     OrderStatus = "out_for_delivery"
	OrderDelivered          OrderStatus = "delivered"
	OrderPickedUp           OrderStatus = "picked_up"
	OrderCancelled          OrderStatus = "cancelled"
)

type PaymentMethod string

const (
	PayCOD    PaymentMethod = "cod"
	PayBkash  PaymentMethod = "bkash"
	PayNagad  PaymentMethod = "nagad"
	PayCard   PaymentMethod = "card"
)

type Order struct {
	ID               uint          `gorm:"primaryKey" json:"id"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
	OrderNumber      string        `gorm:"size:40;uniqueIndex" json:"order_number"`
	UserID           uint          `gorm:"index;not null" json:"user_id"`
	PharmacyID       uint          `gorm:"index;not null" json:"pharmacy_id"`
	PrescriptionID   *uint         `json:"prescription_id,omitempty"`
	Type             OrderType     `gorm:"size:20;default:delivery" json:"type"`
	Status           OrderStatus   `gorm:"size:30;default:placed;index" json:"status"`
	PaymentMethod    PaymentMethod `gorm:"size:20;default:cod" json:"payment_method"`
	PaymentStatus    string        `gorm:"size:20;default:pending" json:"payment_status"`
	Subtotal         float64       `json:"subtotal"`
	DeliveryFee      float64       `json:"delivery_fee"`
	Discount         float64       `json:"discount"`
	Total            float64       `json:"total"`
	DeliveryAddress  string        `gorm:"size:500" json:"delivery_address"`
	DeliveryArea     string        `gorm:"size:120" json:"delivery_area"`
	DeliveryCity     string        `gorm:"size:80" json:"delivery_city"`
	DeliveryLat      float64       `json:"delivery_lat"`
	DeliveryLng      float64       `json:"delivery_lng"`
	CustomerPhone    string        `gorm:"size:20" json:"customer_phone"`
	CustomerName     string        `gorm:"size:120" json:"customer_name"`
	Notes            string        `gorm:"type:text" json:"notes"`
	EstimatedMinutes int           `json:"estimated_minutes"`
	RiderName        string        `gorm:"size:120" json:"rider_name,omitempty"`
	RiderPhone       string        `gorm:"size:20" json:"rider_phone,omitempty"`
	RiderLat         float64       `json:"rider_lat,omitempty"`
	RiderLng         float64       `json:"rider_lng,omitempty"`
	RiderHeading     float64       `json:"rider_heading,omitempty"`
	RiderSpeedKmh    float64       `json:"rider_speed_kmh,omitempty"`
	RiderUpdatedAt   *time.Time    `json:"rider_updated_at,omitempty"`
	DeliveredAt      *time.Time    `json:"delivered_at,omitempty"`
	Items            []OrderItem   `json:"items,omitempty"`
	Pharmacy         *Pharmacy     `json:"pharmacy,omitempty"`
	User             *User         `json:"user,omitempty"`
	StatusHistory    []OrderStatusEvent `json:"status_history,omitempty"`
}

// LiveTracking is the Amazon-style GPS payload for the map.
type LiveTracking struct {
	OrderID             uint      `json:"order_id"`
	OrderNumber         string    `json:"order_number"`
	Status              OrderStatus `json:"status"`
	Type                OrderType `json:"type"`
	RiderName           string    `json:"rider_name,omitempty"`
	RiderPhone          string    `json:"rider_phone,omitempty"`
	RiderLat            float64   `json:"rider_lat"`
	RiderLng            float64   `json:"rider_lng"`
	RiderHeading        float64   `json:"rider_heading"`
	RiderSpeedKmh       float64   `json:"rider_speed_kmh"`
	RiderUpdatedAt      *time.Time `json:"rider_updated_at,omitempty"`
	PharmacyName        string    `json:"pharmacy_name"`
	PharmacyLat         float64   `json:"pharmacy_lat"`
	PharmacyLng         float64   `json:"pharmacy_lng"`
	DestinationAddress  string    `json:"destination_address"`
	DestinationLat      float64   `json:"destination_lat"`
	DestinationLng      float64   `json:"destination_lng"`
	Route               []GeoPoint `json:"route"`
	Progress            float64   `json:"progress"`
	EtaMinutes          int       `json:"eta_minutes"`
	DistanceRemainingKm float64   `json:"distance_remaining_km"`
	AreaLabel           string    `json:"area_label,omitempty"`
	IsLive              bool      `json:"is_live"`
}

type GeoPoint struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type OrderItem struct {
	ID           uint     `gorm:"primaryKey" json:"id"`
	OrderID      uint     `gorm:"index;not null" json:"order_id"`
	MedicineID   uint     `gorm:"index;not null" json:"medicine_id"`
	Name         string   `gorm:"size:200" json:"name"`
	Strength     string   `gorm:"size:60" json:"strength"`
	Quantity     int      `json:"quantity"`
	UnitPrice    float64  `json:"unit_price"`
	TotalPrice   float64  `json:"total_price"`
	RequiresRx   bool     `json:"requires_rx"`
	Medicine     *Medicine `json:"medicine,omitempty"`
}

type OrderStatusEvent struct {
	ID        uint        `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time   `json:"created_at"`
	OrderID   uint        `gorm:"index;not null" json:"order_id"`
	Status    OrderStatus `gorm:"size:30" json:"status"`
	Note      string      `gorm:"size:255" json:"note"`
}

type Review struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time `json:"created_at"`
	UserID     uint      `gorm:"index;not null" json:"user_id"`
	PharmacyID uint      `gorm:"index;not null" json:"pharmacy_id"`
	OrderID    uint      `gorm:"index" json:"order_id"`
	Rating     int       `gorm:"not null" json:"rating"`
	Comment    string    `gorm:"type:text" json:"comment"`
	User       *User     `json:"user,omitempty"`
}

type Banner struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Title     string    `gorm:"size:160" json:"title"`
	Subtitle  string    `gorm:"size:255" json:"subtitle"`
	ImageURL  string    `gorm:"size:500" json:"image_url"`
	LinkURL   string    `gorm:"size:255" json:"link_url"`
	SortOrder int       `json:"sort_order"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
}

type PartnerType string

const (
	PartnerPharmacy  PartnerType = "pharmacy"
	PartnerRider     PartnerType = "rider"
	PartnerAmbulance PartnerType = "ambulance"
	PartnerDoctor    PartnerType = "doctor"
)

type PartnerStatus string

const (
	PartnerPending  PartnerStatus = "pending"
	PartnerApproved PartnerStatus = "approved"
	PartnerRejected PartnerStatus = "rejected"
)

// PartnerApplication stores pharmacy / rider onboarding (AllSamadhan-style).
type PartnerApplication struct {
	ID             uint          `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
	Type           PartnerType   `gorm:"size:20;index;not null" json:"type"`
	Status         PartnerStatus `gorm:"size:20;default:pending;index" json:"status"`
	OwnerName      string        `gorm:"size:120;not null" json:"owner_name"`
	Email          string        `gorm:"size:160;index;not null" json:"email"`
	Phone          string        `gorm:"size:20;not null" json:"phone"`
	PasswordHash   string        `gorm:"size:255" json:"-"`
	NIDNumber      string        `gorm:"size:40" json:"nid_number"`
	BusinessName   string        `gorm:"size:160" json:"business_name"`
	TradeLicense   string        `gorm:"size:80" json:"trade_license"`
	DrugLicense    string        `gorm:"size:80" json:"drug_license"`
	Address        string        `gorm:"size:255" json:"address"`
	Area           string        `gorm:"size:120" json:"area"`
	City           string        `gorm:"size:80;default:Dhaka" json:"city"`
	Latitude       float64       `json:"latitude"`
	Longitude      float64       `json:"longitude"`
	VehicleType    string        `gorm:"size:60" json:"vehicle_type"`
	VehicleNumber  string        `gorm:"size:40" json:"vehicle_number"`
	PaymentMethod  string        `gorm:"size:40" json:"payment_method"` // bkash / nagad / bank
	PaymentAccount string        `gorm:"size:80" json:"payment_account"`
	Notes          string        `gorm:"type:text" json:"notes"`
	UserID         *uint         `json:"user_id,omitempty"`
	PharmacyID     *uint         `json:"pharmacy_id,omitempty"`
	Specialty      string        `gorm:"size:120" json:"specialty,omitempty"`
	BMDCNumber     string        `gorm:"size:80" json:"bmdc_number,omitempty"`
	IsFreeConsult  bool          `json:"is_free_consult,omitempty"`
	ConsultFee     float64       `json:"consult_fee,omitempty"`
}

type DoctorProfile struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	UserID        uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	Specialty     string    `gorm:"size:120;index;not null" json:"specialty"`
	SpecialtyBn   string    `gorm:"size:120" json:"specialty_bn"`
	BMDCNumber    string    `gorm:"size:80" json:"bmdc_number"`
	Bio           string    `gorm:"type:text" json:"bio"`
	IsFreeConsult bool      `gorm:"default:false;index" json:"is_free_consult"`
	ConsultFee    float64   `gorm:"default:0" json:"consult_fee"`
	YearsExp      int       `json:"years_exp"`
	Languages     string    `gorm:"size:120;default:Bangla,English" json:"languages"`
	IsAvailable   bool      `gorm:"default:true" json:"is_available"`
	Rating        float64   `gorm:"default:4.8" json:"rating"`
	User          *User     `json:"user,omitempty"`
}

type ConsultStatus string

const (
	ConsultActive      ConsultStatus = "active"
	ConsultMatched     ConsultStatus = "matched"
	ConsultInReview    ConsultStatus = "in_review"
	ConsultPrescribed  ConsultStatus = "prescribed"
	ConsultCompleted   ConsultStatus = "completed"
	ConsultCancelled   ConsultStatus = "cancelled"
)

type Consultation struct {
	ID                 uint          `gorm:"primaryKey" json:"id"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`
	PatientID          uint          `gorm:"index;not null" json:"patient_id"`
	DoctorID           *uint         `gorm:"index" json:"doctor_id,omitempty"`
	Status             ConsultStatus `gorm:"size:30;default:active;index" json:"status"`
	PreferredPaid      *bool         `json:"preferred_paid,omitempty"` // nil=any, false=prefer free, true=paid
	SuggestedSpecialty string        `gorm:"size:120" json:"suggested_specialty"`
	SummaryBn          string        `gorm:"type:text" json:"summary_bn"`
	SummaryEn          string        `gorm:"type:text" json:"summary_en"`
	SymptomsJSON       string        `gorm:"type:text" json:"symptoms_json"`
	MatchReason        string        `gorm:"size:255" json:"match_reason"`
	PrescriptionID     *uint         `json:"prescription_id,omitempty"`
	Patient            *User         `json:"patient,omitempty"`
	Doctor             *User         `json:"doctor,omitempty"`
	DoctorProfile      *DoctorProfile `gorm:"-" json:"doctor_profile,omitempty"`
	Messages           []ConsultMessage `json:"messages,omitempty"`
}

type ConsultMessage struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	ConsultationID uint      `gorm:"index;not null" json:"consultation_id"`
	Role           string    `gorm:"size:20;not null" json:"role"` // patient | agent | doctor
	Content        string    `gorm:"type:text;not null" json:"content"`
	Lang           string    `gorm:"size:10;default:bn" json:"lang"`
	IsVoice        bool      `gorm:"default:false" json:"is_voice"`
}

// Extend prescription for doctor-authored structured Rx
type PrescriptionItem struct {
	ID             uint    `gorm:"primaryKey" json:"id"`
	PrescriptionID uint    `gorm:"index;not null" json:"prescription_id"`
	MedicineName   string  `gorm:"size:200;not null" json:"medicine_name"`
	GenericName    string  `gorm:"size:200" json:"generic_name"`
	Strength       string  `gorm:"size:60" json:"strength"`
	Dosage         string  `gorm:"size:120" json:"dosage"`
	Duration       string  `gorm:"size:80" json:"duration"`
	Quantity       int     `json:"quantity"`
	Instructions   string  `gorm:"size:255" json:"instructions"`
	MedicineID     *uint   `json:"medicine_id,omitempty"`
}

type AppointmentMode string

const (
	ModeVideo AppointmentMode = "video"
	ModePhone AppointmentMode = "phone"
	ModeChat  AppointmentMode = "chat"
)

type AppointmentStatus string

const (
	ApptScheduled AppointmentStatus = "scheduled"
	ApptReady     AppointmentStatus = "ready"
	ApptRinging   AppointmentStatus = "ringing"
	ApptInCall    AppointmentStatus = "in_call"
	ApptCompleted AppointmentStatus = "completed"
	ApptCancelled AppointmentStatus = "cancelled"
)

type DoctorSlot struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	DoctorID  uint      `gorm:"index;not null" json:"doctor_id"` // user id of doctor
	StartsAt  time.Time `gorm:"index;not null" json:"starts_at"`
	EndsAt    time.Time `json:"ends_at"`
	IsBooked  bool      `gorm:"default:false;index" json:"is_booked"`
	ModeHint  string    `gorm:"size:20;default:video" json:"mode_hint"`
}

type Appointment struct {
	ID             uint              `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
	PatientID      uint              `gorm:"index;not null" json:"patient_id"`
	DoctorID       uint              `gorm:"index;not null" json:"doctor_id"`
	SlotID         *uint             `gorm:"index" json:"slot_id,omitempty"`
	ConsultationID *uint             `gorm:"index" json:"consultation_id,omitempty"`
	CallSessionID  *uint             `json:"call_session_id,omitempty"`
	Mode           AppointmentMode   `gorm:"size:20;default:video;index" json:"mode"`
	Status         AppointmentStatus `gorm:"size:30;default:scheduled;index" json:"status"`
	ScheduledAt    time.Time         `gorm:"index;not null" json:"scheduled_at"`
	EndsAt         time.Time         `json:"ends_at"`
	Reason         string            `gorm:"size:500" json:"reason"`
	ReasonBn       string            `gorm:"size:500" json:"reason_bn"`
	Fee            float64           `json:"fee"`
	IsFree         bool              `json:"is_free"`
	IsInstant      bool              `gorm:"default:false" json:"is_instant"`
	Patient        *User             `json:"patient,omitempty"`
	Doctor         *User             `json:"doctor,omitempty"`
	DoctorProfile  *DoctorProfile    `gorm:"-" json:"doctor_profile,omitempty"`
	CallSession    *CallSession      `json:"call_session,omitempty"`
}

type CallStatus string

const (
	CallWaiting CallStatus = "waiting"
	CallRinging CallStatus = "ringing"
	CallActive  CallStatus = "active"
	CallEnded   CallStatus = "ended"
	CallMissed  CallStatus = "missed"
)

type CallSession struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	AppointmentID uint       `gorm:"index;not null" json:"appointment_id"`
	PatientID     uint       `gorm:"index;not null" json:"patient_id"`
	DoctorID      uint       `gorm:"index;not null" json:"doctor_id"`
	Mode          AppointmentMode `gorm:"size:20;default:video" json:"mode"`
	Status        CallStatus `gorm:"size:20;default:waiting;index" json:"status"`
	StartedBy     uint       `json:"started_by"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	AnsweredAt    *time.Time `json:"answered_at,omitempty"`
	EndedAt       *time.Time `json:"ended_at,omitempty"`
	Patient       *User      `json:"patient,omitempty"`
	Doctor        *User      `json:"doctor,omitempty"`
}

type CallSignal struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	CallSessionID uint      `gorm:"index;not null" json:"call_session_id"`
	FromUserID    uint      `gorm:"index;not null" json:"from_user_id"`
	Kind          string    `gorm:"size:20;not null" json:"kind"` // offer | answer | ice | hangup
	Payload       string    `gorm:"type:text;not null" json:"payload"`
}
