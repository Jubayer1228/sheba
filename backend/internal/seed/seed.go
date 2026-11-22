package seed

import (
	"log"
	"time"

	"github.com/sheba/pharmacy/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func Run(db *gorm.DB) {
	seedDoctors(db)

	var count int64
	db.Model(&models.Pharmacy{}).Count(&count)
	if count > 0 {
		return
	}
	log.Println("seeding Sheba pharmacy marketplace data...")

	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	demo := models.User{
		Name:     "Rahim Ahmed",
		Email:    "demo@sheba.com.bd",
		Phone:    "01712345678",
		Password: string(hash),
		Role:     models.RoleCustomer,
	}
	db.Create(&demo)
	db.Create(&models.Address{
		UserID: demo.ID, Label: "Home", Line1: "House 12, Road 4, Dhanmondi",
		Area: "Dhanmondi", City: "Dhaka", PostalCode: "1209",
		Latitude: 23.7461, Longitude: 90.3742, IsDefault: true,
	})

	categories := []models.Category{
		{Name: "Fever & Pain",Slug: "fever-pain", Icon: "thermometer", SortOrder: 1, Description: "Paracetamol, ibuprofen & more"},
		{Name: "Cold & Cough", Slug: "cold-cough", Icon: "wind", SortOrder: 2, Description: "Syrups, lozenges, antihistamines"},
		{Name: "Stomach Care", Slug: "stomach", Icon: "pill", SortOrder: 3, Description: "Antacids, anti-diarrhoeals"},
		{Name: "Antibiotics", Slug: "antibiotics", Icon: "shield", SortOrder: 4, Description: "Prescription antibiotics"},
		{Name: "Diabetes", Slug: "diabetes", Icon: "droplet", SortOrder: 5, Description: "Glucose care & insulin aids"},
		{Name: "Heart & BP", Slug: "heart-bp", Icon: "heart", SortOrder: 6, Description: "Cardiac & hypertension"},
		{Name: "Vitamins", Slug: "vitamins", Icon: "sparkles", SortOrder: 7, Description: "Multivitamins & supplements"},
		{Name: "Baby Care", Slug: "baby", Icon: "baby", SortOrder: 8, Description: "Infant medicines & care"},
		{Name: "Skin Care", Slug: "skin", Icon: "sparkle", SortOrder: 9, Description: "Creams, ointments, lotions"},
		{Name: "First Aid", Slug: "first-aid", Icon: "cross", SortOrder: 10, Description: "Bandages, antiseptics"},
	}
	for i := range categories {
		db.Create(&categories[i])
	}

	banners := []models.Banner{
		{Title: "Upload prescription", Subtitle: "Get medicines from nearby pharmacies in minutes", ImageURL: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200&q=80", LinkURL: "/prescription", SortOrder: 1},
		{Title: "Fast pharmacy delivery", Subtitle: "Partner pharmacies across Dhaka — order in a few taps", ImageURL: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=1200&q=80", LinkURL: "/", SortOrder: 2},
		{Title: "Daily health essentials", Subtitle: "ORS, vitamins & gastric care stocked near you", ImageURL: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=1200&q=80", LinkURL: "/search?q=vitamin", SortOrder: 3},
	}
	for i := range banners {
		db.Create(&banners[i])
	}

	type pharmaDef struct {
		Name, Slug, Desc, Area, Address, Phone, Tags, Image string
		Lat, Lng, Rating, Fee, Min                          float64
		Minutes, Reviews                                    int
		Open, Rx, Pickup, Delivery                          bool
	}

	pharmacies := []pharmaDef{
		{"Lazz Pharma Dhanmondi", "lazz-dhanmondi", "Trusted neighbourhood pharmacy with 24/7 emergency counter.", "Dhanmondi", "Road 6, Dhanmondi, Dhaka", "01711001001", "24/7,prescription,trusted", "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80", 23.7465, 90.3760, 4.8, 39, 150, 25, 1240, true, true, true, true},
		{"Ibn Sina Pharmacy Gulshan", "ibn-sina-gulshan", "Hospital-grade medicines with licensed pharmacists on duty.", "Gulshan", "Gulshan Avenue, Dhaka", "01711001002", "hospital,premium,rx", "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80", 23.7808, 90.4142, 4.7, 59, 200, 35, 890, true, true, true, true},
		{"Square Pharmacy Banani", "square-banani", "Official Square products and chronic care refills.", "Banani", "Banani 11, Dhaka", "01711001003", "square,chronic,diabetes", "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80", 23.7937, 90.4066, 4.6, 49, 100, 30, 650, true, true, true, true},
		{"Popular Pharmacy Mirpur", "popular-mirpur", "Affordable generics and family health essentials.", "Mirpur", "Mirpur 10, Dhaka", "01711001004", "budget,family,generics", "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&q=80", 23.8069, 90.3687, 4.4, 29, 80, 40, 2100, true, true, true, true},
		{"MedEx Uttara", "medex-uttara", "Fast delivery hub for Uttara sector residents.", "Uttara", "Sector 7, Uttara, Dhaka", "01711001005", "fast,delivery,uttara", "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=800&q=80", 23.8759, 90.3795, 4.5, 45, 120, 28, 540, true, true, true, true},
		{"Arogga Partner Motijheel", "arogga-motijheel", "Corporate area pharmacy with express pickup.", "Motijheel", "Motijheel C/A, Dhaka", "01711001006", "express,pickup,office", "https://images.unsplash.com/photo-1512069772995-ec65ed777096?w=800&q=80", 23.7330, 90.4172, 4.3, 35, 100, 32, 320, true, true, true, true},
		{"Healthcare Pharmacy Mohammadpur", "healthcare-mohammadpur", "Community pharmacy with baby & elderly care.", "Mohammadpur", "Asad Gate, Mohammadpur", "01711001007", "baby,elderly,community", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80", 23.7651, 90.3580, 4.5, 35, 90, 30, 780, true, true, true, true},
		{"Green Life Pharmacy Bashundhara", "greenlife-bashundhara", "Modern retail pharmacy inside Bashundhara.", "Bashundhara", "Block C, Bashundhara R/A", "01711001008", "modern,retail,vitamins", "https://images.unsplash.com/photo-1563213126-a4273aed2016?w=800&q=80", 23.8151, 90.4272, 4.6, 55, 150, 38, 410, true, true, true, true},
		{"Apollo Pharmacy Wari", "apollo-wari", "Old Dhaka favourite for trusted brands.", "Wari", "Rankin Street, Wari", "01711001009", "old-dhaka,trusted", "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80", 23.7112, 90.4203, 4.2, 40, 100, 45, 290, true, true, true, true},
		{"LifeSpring Pharmacy Bailey Road", "lifespring-bailey", "Women & child health focused pharmacy.", "Bailey Road", "New Bailey Road, Dhaka", "01711001010", "women,child,specialty", "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80", 23.7415, 90.4078, 4.7, 49, 120, 28, 560, true, true, true, true},
		{"Night Owl Pharmacy Farmgate", "nightowl-farmgate", "Open late for urgent prescriptions.", "Farmgate", "Farmgate, Dhaka", "01711001011", "late-night,urgent,24/7", "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80", 23.7563, 90.3900, 4.4, 55, 100, 22, 980, true, true, true, true},
		{"City Drug Store Tejgaon", "citydrug-tejgaon", "Industrial area pharmacy with bulk packs.", "Tejgaon", "Tejgaon Industrial Area", "01711001012", "bulk,industrial", "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&q=80", 23.7640, 90.3984, 4.1, 30, 80, 35, 180, true, false, true, true},
	}

	createdPharmacies := make([]models.Pharmacy, 0, len(pharmacies))
	for _, p := range pharmacies {
		ph := models.Pharmacy{
			Name: p.Name, Slug: p.Slug, Description: p.Desc, ImageURL: p.Image, CoverURL: p.Image,
			Phone: p.Phone, Address: p.Address, Area: p.Area, City: "Dhaka",
			Latitude: p.Lat, Longitude: p.Lng, Rating: p.Rating, ReviewCount: p.Reviews,
			DeliveryFee: p.Fee, MinOrder: p.Min, DeliveryMinutes: p.Minutes,
			IsOpen: p.Open, AcceptsRx: p.Rx, HasPickup: p.Pickup, HasDelivery: p.Delivery, Tags: p.Tags,
		}
		db.Create(&ph)
		createdPharmacies = append(createdPharmacies, ph)
	}

	type medDef struct {
		Name, Generic, Brand, Strength, Form, Pack, Mfr, Desc string
		CatIdx                                                int
		Price                                                 float64
		Discount                                              float64
		Rx, Featured                                          bool
		Stock                                                 int
	}

	catalog := []medDef{
		{"Napa", "Paracetamol", "Beximco", "500mg", "Tablet", "10 tablets", "Beximco Pharmaceuticals", "Fast relief from fever and mild to moderate pain.", 0, 12, 0, false, true, 500},
		{"Napa Extend", "Paracetamol", "Beximco", "665mg", "Tablet", "12 tablets", "Beximco Pharmaceuticals", "Extended relief paracetamol for longer fever control.", 0, 28, 5, false, true, 300},
		{"Ace", "Paracetamol", "Square", "500mg", "Tablet", "10 tablets", "Square Pharmaceuticals", "Trusted Square paracetamol for everyday fever.", 0, 11, 0, false, false, 400},
		{"Seclo", "Omeprazole", "Square", "20mg", "Capsule", "10 capsules", "Square Pharmaceuticals", "Reduces stomach acid; for gastritis and ulcers.", 2, 50, 10, false, true, 350},
		{"Maxpro", "Esomeprazole", "Renata", "20mg", "Capsule", "10 capsules", "Renata Limited", "PPI for acid reflux and heartburn.", 2, 70, 0, false, true, 280},
		{"Sergel", "Esomeprazole", "Healthcare", "20mg", "Capsule", "14 capsules", "Healthcare Pharmaceuticals", "Popular gastric care capsule.", 2, 80, 8, false, false, 260},
		{"Fexo", "Fexofenadine", "Square", "120mg", "Tablet", "10 tablets", "Square Pharmaceuticals", "Non-drowsy antihistamine for allergy & cold.", 1, 60, 0, false, true, 300},
		{"Histacin", "Chlorpheniramine", "Square", "4mg", "Tablet", "20 tablets", "Square Pharmaceuticals", "Classic antihistamine for runny nose.", 1, 15, 0, false, false, 450},
		{"Brofex", "Dextromethorphan", "Square", "15mg/5ml", "Syrup", "100ml", "Square Pharmaceuticals", "Cough suppressant syrup for dry cough.", 1, 55, 0, false, false, 200},
		{"Amoxicil", "Amoxicillin", "Square", "500mg", "Capsule", "10 capsules", "Square Pharmaceuticals", "Broad-spectrum antibiotic. Prescription required.", 3, 90, 0, true, true, 180},
		{"Ciprocin", "Ciprofloxacin", "Square", "500mg", "Tablet", "10 tablets", "Square Pharmaceuticals", "Antibiotic for bacterial infections. Rx required.", 3, 120, 5, true, false, 150},
		{"Azithrocin", "Azithromycin", "Beximco", "500mg", "Tablet", "3 tablets", "Beximco Pharmaceuticals", "Once-daily macrolide antibiotic. Rx required.", 3, 95, 0, true, true, 160},
		{"Comet", "Metformin", "Square", "500mg", "Tablet", "30 tablets", "Square Pharmaceuticals", "First-line oral therapy for type 2 diabetes.", 4, 45, 0, true, true, 220},
		{"Diapro", "Gliclazide", "Square", "80mg", "Tablet", "20 tablets", "Square Pharmaceuticals", "Sulfonylurea for blood sugar control. Rx.", 4, 80, 0, true, false, 140},
		{"Tenolite", "Amlodipine", "Incepta", "5mg", "Tablet", "30 tablets", "Incepta Pharmaceuticals", "Calcium channel blocker for hypertension.", 5, 60, 0, true, true, 200},
		{"Losectil", "Omeprazole", "Healthcare", "20mg", "Capsule", "14 capsules", "Healthcare Pharmaceuticals", "Acid reducer for long-term gastric care.", 2, 65, 10, false, false, 240},
		{"Bextram Gold", "Multivitamin", "Beximco", "Adult", "Tablet", "30 tablets", "Beximco Pharmaceuticals", "Daily multivitamin with minerals.", 6, 180, 15, false, true, 300},
		{"Ceevit", "Vitamin C", "Square", "250mg", "Tablet", "20 tablets", "Square Pharmaceuticals", "Vitamin C for immunity support.", 6, 30, 0, false, true, 500},
		{"ORSaline-N", "ORS", "SMC", "Standard", "Sachets", "10 sachets", "Social Marketing Company", "WHO-formula oral rehydration salts.", 2, 45, 0, false, true, 600},
		{"Pantonix", "Pantoprazole", "Incepta", "40mg", "Tablet", "10 tablets", "Incepta Pharmaceuticals", "PPI for GERD and peptic ulcer.", 2, 75, 0, false, false, 210},
		{"Napa Syrup", "Paracetamol", "Beximco", "120mg/5ml", "Syrup", "60ml", "Beximco Pharmaceuticals", "Child fever syrup with measuring cup.", 7, 35, 0, false, true, 280},
		{"Tuska Baby", "Baby care oil", "Square", "100ml", "Oil", "100ml", "Square Toiletries", "Gentle massage oil for infants.", 7, 120, 5, false, false, 150},
		{"Neotack", "Ranitidine", "Beximco", "150mg", "Tablet", "10 tablets", "Beximco Pharmaceuticals", "H2 blocker for acid control.", 2, 25, 0, false, false, 190},
		{"Zithrin", "Azithromycin", "Square", "500mg", "Tablet", "5 tablets", "Square Pharmaceuticals", "Azithromycin for respiratory infections. Rx.", 3, 110, 0, true, false, 130},
		{"Monas", "Montelukast", "ACI", "10mg", "Tablet", "10 tablets", "ACI Limited", "Asthma & allergy leukotriene inhibitor. Rx.", 1, 140, 0, true, true, 120},
		{"Alatrol", "Cetirizine", "Square", "10mg", "Tablet", "10 tablets", "Square Pharmaceuticals", "Daily antihistamine for allergic rhinitis.", 1, 25, 0, false, false, 340},
		{"Napa Extra", "Paracetamol+Caffeine", "Beximco", "500mg+65mg", "Tablet", "10 tablets", "Beximco Pharmaceuticals", "Enhanced headache and pain relief.", 0, 20, 0, false, true, 360},
		{"Entacyd Plus", "Antacid", "Square", "400mg", "Tablet", "20 tablets", "Square Pharmaceuticals", "Chewable antacid for instant acidity relief.", 2, 40, 0, false, false, 400},
		{"Betnovate Cream", "Betamethasone", "GSK", "0.1%", "Cream", "20g", "GlaxoSmithKline", "Topical steroid for eczema & dermatitis. Rx.", 8, 95, 0, true, false, 100},
		{"Savlon Antiseptic", "Chlorhexidine", "ACI", "100ml", "Liquid", "100ml", "ACI Limited", "Household antiseptic for cuts and scrapes.", 9, 85, 0, false, true, 250},
		{"Band-Aid Pack", "Adhesive bandage", "J&J", "Assorted", "Pack", "20 pcs", "Johnson & Johnson", "Assorted first-aid bandages.", 9, 60, 0, false, false, 300},
		{"Insulin Syringe", "Disposable syringe", "BD", "1ml", "Syringe", "10 pcs", "Becton Dickinson", "U-100 insulin syringes.", 4, 150, 0, false, false, 90},
		{"Glucolyte", "Glucose powder", "Renata", "75g", "Powder", "1 sachet", "Renata Limited", "Oral glucose for energy and tests.", 4, 35, 0, false, false, 200},
		{"Concor", "Bisoprolol", "Healthcare", "5mg", "Tablet", "30 tablets", "Healthcare Pharmaceuticals", "Beta blocker for BP and heart rate. Rx.", 5, 220, 0, true, false, 110},
		{"Amlodipine SK+F", "Amlodipine", "SK+F", "5mg", "Tablet", "30 tablets", "Eskayef Pharmaceuticals", "Affordable hypertension control. Rx.", 5, 45, 0, true, false, 180},
		{"Calbo-D", "Calcium+Vitamin D", "Square", "500mg", "Tablet", "30 tablets", "Square Pharmaceuticals", "Bone health calcium with vitamin D.", 6, 150, 10, false, true, 270},
		{"Neurocare", "Vitamin B complex", "Incepta", "Adult", "Capsule", "30 capsules", "Incepta Pharmaceuticals", "Neurotropic B vitamins.", 6, 160, 0, false, false, 160},
		{"Napa Rapid", "Paracetamol", "Beximco", "500mg", "Tablet", "10 tablets", "Beximco Pharmaceuticals", "Rapid-dissolve fever tablet.", 0, 18, 0, false, false, 220},
		{"Econazole Cream", "Econazole", "Square", "1%", "Cream", "15g", "Square Pharmaceuticals", "Antifungal cream for skin infections.", 8, 70, 0, false, false, 140},
		{"Omep", "Omeprazole", "Eskayef", "20mg", "Capsule", "10 capsules", "Eskayef Pharmaceuticals", "Budget-friendly gastric capsule.", 2, 35, 0, false, false, 310},
	}

	imgByForm := map[string]string{
		"Tablet":  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
		"Capsule": "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&q=80",
		"Syrup":   "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80",
		"Cream":   "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80",
		"Oil":     "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&q=80",
		"Liquid":  "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&q=80",
		"Sachets": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
		"Powder":  "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80",
		"Syringe": "https://images.unsplash.com/photo-1583912267550-d5240b5b0661?w=400&q=80",
		"Pack":    "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400&q=80",
	}

	for i, ph := range createdPharmacies {
		// Each pharmacy gets a rotating subset so catalogs feel distinct
		for j, m := range catalog {
			if (j+i)%3 == 2 && i%2 == 1 {
				continue
			}
			priceMul := 1.0 + float64((i+j)%3)*0.03
			med := models.Medicine{
				PharmacyID:   ph.ID,
				CategoryID:   categories[m.CatIdx].ID,
				Name:         m.Name,
				GenericName:  m.Generic,
				Brand:        m.Brand,
				Description:  m.Desc,
				ImageURL:     imgByForm[m.Form],
				Strength:     m.Strength,
				Form:         m.Form,
				PackSize:     m.Pack,
				Price:        float64(int(m.Price*priceMul*100)) / 100,
				DiscountPct:  m.Discount,
				Stock:        m.Stock - (i % 7),
				RequiresRx:   m.Rx,
				IsFeatured:   m.Featured && i < 6,
				Manufacturer: m.Mfr,
			}
			if med.ImageURL == "" {
				med.ImageURL = imgByForm["Tablet"]
			}
			db.Create(&med)
		}
	}

	log.Println("seed complete")
}

func seedDoctors(db *gorm.DB) {
	var count int64
	db.Model(&models.DoctorProfile{}).Count(&count)
	if count == 0 {
		log.Println("seeding Sheba doctors...")
		seedDoctorRows(db)
	}
	seedDoctorSlots(db)
}

func seedDoctorRows(db *gorm.DB) {

	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)

	type docDef struct {
		Name, Email, Phone, Specialty, SpecialtyBn, BMDC, Bio string
		Free                                                  bool
		Fee                                                   float64
		Years                                                 int
		Rating                                                float64
	}
	docs := []docDef{
		{"Dr. Nusrat Jahan", "doctor@sheba.com.bd", "01811000001", "General Physician", "জেনারেল ফিজিশিয়ান", "BMDC-A-1001", "Bangla-speaking GP for fever, cough and everyday care.", true, 0, 8, 4.9},
		{"Dr. Karim Hossain", "doctor.paid@sheba.com.bd", "01811000002", "General Physician", "জেনারেল ফিজিশিয়ান", "BMDC-A-1002", "Experienced GP with paid video consult slots.", false, 399, 12, 4.8},
		{"Dr. Farhana Islam", "doctor.skin@sheba.com.bd", "01811000003", "Dermatology", "ডার্মাটোলজি", "BMDC-A-2001", "Skin, rash and allergy specialist — free consult hours.", true, 0, 7, 4.7},
		{"Dr. Rafiqul Alam", "doctor.cardio@sheba.com.bd", "01811000004", "Cardiology", "কার্ডিওলজি", "BMDC-A-3001", "Hypertension and heart care specialist.", false, 599, 15, 4.9},
		{"Dr. Sabina Yasmin", "doctor.gastro@sheba.com.bd", "01811000005", "Gastroenterology", "গ্যাস্ট্রোএন্টারোলজি", "BMDC-A-4001", "Gastric, diarrhea and stomach issues.", true, 0, 9, 4.6},
		{"Dr. Tanvir Ahmed", "doctor.endo@sheba.com.bd", "01811000006", "Endocrinology", "এন্ডোক্রাইনোলজি", "BMDC-A-5001", "Diabetes and hormone care.", false, 499, 11, 4.8},
		{"Dr. Laila Rahman", "doctor.ent@sheba.com.bd", "01811000007", "ENT", "নাক-কান-গলা", "BMDC-A-6001", "Cold, cough, sinus and throat.", true, 0, 6, 4.5},
	}

	for _, d := range docs {
		u := models.User{
			Name: d.Name, Email: d.Email, Phone: d.Phone,
			Password: string(hash), Role: models.RoleDoctor,
		}
		if err := db.Create(&u).Error; err != nil {
			continue
		}
		db.Create(&models.DoctorProfile{
			UserID: u.ID, Specialty: d.Specialty, SpecialtyBn: d.SpecialtyBn,
			BMDCNumber: d.BMDC, Bio: d.Bio, IsFreeConsult: d.Free, ConsultFee: d.Fee,
			YearsExp: d.Years, Languages: "Bangla,English", IsAvailable: true, Rating: d.Rating,
		})
		db.Create(&models.PartnerApplication{
			Type: models.PartnerDoctor, Status: models.PartnerApproved,
			OwnerName: d.Name, Email: d.Email, Phone: d.Phone, PasswordHash: string(hash),
			NIDNumber: "1990"+d.BMDC[len(d.BMDC)-4:], Specialty: d.Specialty, BMDCNumber: d.BMDC,
			IsFreeConsult: d.Free, ConsultFee: d.Fee, City: "Dhaka", Area: "Dhanmondi",
			UserID: &u.ID, PaymentMethod: "bkash", PaymentAccount: d.Phone,
		})
	}
	log.Println("doctor seed complete")
}

func seedDoctorSlots(db *gorm.DB) {
	var open int64
	db.Model(&models.DoctorSlot{}).Where("starts_at > ? AND is_booked = ?", time.Now(), false).Count(&open)
	if open > 20 {
		return
	}
	log.Println("seeding doctor appointment slots...")
	var doctors []models.DoctorProfile
	db.Find(&doctors)
	now := time.Now()
	for _, d := range doctors {
		for day := 0; day < 5; day++ {
			base := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, now.Location()).AddDate(0, 0, day)
			for _, hour := range []int{9, 10, 11, 14, 15, 16, 18, 19, 20} {
				start := base.Add(time.Duration(hour) * time.Hour)
				if start.Before(now.Add(10 * time.Minute)) {
					continue
				}
				var exists int64
				db.Model(&models.DoctorSlot{}).Where("doctor_id = ? AND starts_at = ?", d.UserID, start).Count(&exists)
				if exists > 0 {
					continue
				}
				db.Create(&models.DoctorSlot{
					DoctorID: d.UserID,
					StartsAt: start,
					EndsAt:   start.Add(20 * time.Minute),
					ModeHint: "video",
				})
			}
		}
		// always keep a couple of near-term ready slots for demo
		for _, mins := range []int{5, 25, 45} {
			start := now.Add(time.Duration(mins) * time.Minute).Truncate(time.Minute)
			db.Create(&models.DoctorSlot{
				DoctorID: d.UserID,
				StartsAt: start,
				EndsAt:   start.Add(20 * time.Minute),
				ModeHint: "phone",
			})
		}
	}
	log.Println("doctor slots seed complete")
}
