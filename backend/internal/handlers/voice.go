package handlers

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sheba/pharmacy/internal/ai"
	"github.com/sheba/pharmacy/internal/middleware"
	"github.com/sheba/pharmacy/internal/models"
	"gorm.io/gorm"
)

func (h *Handler) VoiceStatus(c *gin.Context) {
	h.ok(c, gin.H{
		"llm":      h.LLM != nil && h.LLM.Enabled(),
		"deepgram": h.DG != nil && h.DG.Enabled(),
		"model": func() string {
			if h.LLM == nil {
				return ""
			}
			return h.LLM.Model
		}(),
		"stt_language": func() string {
			if h.DG == nil {
				return ""
			}
			return h.DG.STTLang
		}(),
		"tts_model": func() string {
			if h.DG == nil {
				return ""
			}
			return h.DG.TTSModel
		}(),
	})
}

func (h *Handler) VoiceTranscribe(c *gin.Context) {
	if h.DG == nil || !h.DG.Enabled() {
		h.fail(c, http.StatusServiceUnavailable, "Deepgram not configured")
		return
	}
	file, err := c.FormFile("audio")
	if err != nil {
		h.fail(c, http.StatusBadRequest, "audio file required")
		return
	}
	f, err := file.Open()
	if err != nil {
		h.fail(c, http.StatusBadRequest, "could not read audio")
		return
	}
	defer f.Close()
	buf, err := io.ReadAll(io.LimitReader(f, 8<<20))
	if err != nil {
		h.fail(c, http.StatusBadRequest, "could not read audio")
		return
	}
	ctype := file.Header.Get("Content-Type")
	if ctype == "" {
		ctype = "audio/webm"
	}
	text, err := h.DG.Transcribe(buf, ctype)
	if err != nil {
		h.fail(c, http.StatusBadGateway, err.Error())
		return
	}
	h.ok(c, gin.H{"transcript": text, "language": h.DG.STTLang})
}

func (h *Handler) VoiceSpeak(c *gin.Context) {
	if h.DG == nil || !h.DG.Enabled() {
		h.fail(c, http.StatusServiceUnavailable, "Deepgram not configured")
		return
	}
	var body struct {
		Text string `json:"text" binding:"required"`
		Lang string `json:"lang"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		h.fail(c, http.StatusBadRequest, "text required")
		return
	}
	audio, ctype, err := h.DG.Speak(body.Text)
	if err != nil {
		h.fail(c, http.StatusBadGateway, err.Error())
		return
	}
	h.ok(c, gin.H{
		"mime":       ctype,
		"audio_b64":  base64.StdEncoding.EncodeToString(audio),
		"chars":      len(body.Text),
		"tts_model":  h.DG.TTSModel,
		"note":       "Deepgram Aura voices are English; pass reply_en for best quality",
	})
}

// VoiceTurn: optional audio or text → triage agent → TTS audio (Deepgram) + Bangla reply.
func (h *Handler) VoiceTurn(c *gin.Context) {
	userID := middleware.GetUserID(c)
	contentType := c.ContentType()
	var (
		userText string
		isVoice  bool
		consultID uint
		lang     = "en"
	)

	if strings.HasPrefix(contentType, "multipart/") {
		consultID = parseUintForm(c.PostForm("consultation_id"))
		lang = c.DefaultPostForm("lang", "en")
		userText = strings.TrimSpace(c.PostForm("text"))
		if file, err := c.FormFile("audio"); err == nil && h.DG != nil && h.DG.Enabled() {
			f, err := file.Open()
			if err == nil {
				buf, _ := io.ReadAll(io.LimitReader(f, 8<<20))
				_ = f.Close()
				ctype := file.Header.Get("Content-Type")
				if ctype == "" {
					ctype = "audio/webm"
				}
				tr, err := h.DG.Transcribe(buf, ctype)
				if err != nil {
					h.fail(c, http.StatusBadGateway, "transcription failed: "+err.Error())
					return
				}
				if tr != "" {
					userText = tr
					isVoice = true
				}
			}
		}
	} else {
		var body struct {
			ConsultationID uint   `json:"consultation_id"`
			Text           string `json:"text"`
			Lang           string `json:"lang"`
			IsVoice        bool   `json:"is_voice"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			h.fail(c, http.StatusBadRequest, "invalid payload")
			return
		}
		consultID = body.ConsultationID
		userText = strings.TrimSpace(body.Text)
		isVoice = body.IsVoice
		if body.Lang != "" {
			lang = body.Lang
		}
	}

	if userText == "" {
		h.fail(c, http.StatusBadRequest, "speak or type a message")
		return
	}

	var consult models.Consultation
	if consultID == 0 {
		consult = models.Consultation{PatientID: userID, Status: models.ConsultActive}
		if err := h.DB.Create(&consult).Error; err != nil {
			h.fail(c, http.StatusInternalServerError, "could not start consultation")
			return
		}
		h.DB.Create(&models.ConsultMessage{
			ConsultationID: consult.ID,
			Role:           "agent",
			Content:        "Hi! I'm Sheba's voice health assistant. Speak or type your symptoms in English.",
			Lang:           "en",
		})
	} else {
		if err := h.DB.Where("id = ? AND patient_id = ?", consultID, userID).First(&consult).Error; err != nil {
			h.fail(c, http.StatusNotFound, "consultation not found")
			return
		}
	}

	h.DB.Create(&models.ConsultMessage{
		ConsultationID: consult.ID,
		Role:           "patient",
		Content:        userText,
		Lang:           lang,
		IsVoice:        isVoice,
	})

	history := h.consultHistoryForLLM(consult.ID)
	triage := ai.Triage(h.LLM, history, userText)

	consult.SuggestedSpecialty = triage.Specialty
	if triage.PreferPaid != nil {
		consult.PreferredPaid = triage.PreferPaid
	}
	reply := ai.PrimaryReply(triage, lang)
	if triage.Ready {
		consult.SummaryBn = triage.SummaryBn
		if consult.SummaryBn == "" {
			consult.SummaryBn = reply
		}
		consult.SummaryEn = triage.ReplyEn
		if consult.SummaryEn == "" {
			consult.SummaryEn = reply
		}
	}
	sym := map[string]interface{}{"last": userText, "source": triage.Source}
	if b, err := json.Marshal(sym); err == nil {
		consult.SymptomsJSON = string(b)
	}
	h.DB.Save(&consult)

	h.DB.Create(&models.ConsultMessage{
		ConsultationID: consult.ID,
		Role:           "agent",
		Content:        reply,
		Lang:           lang,
	})

	var audioB64, mime string
	speakText := reply
	if h.DG != nil && h.DG.Enabled() && speakText != "" {
		if audio, ct, err := h.DG.Speak(speakText); err == nil {
			audioB64 = base64.StdEncoding.EncodeToString(audio)
			mime = ct
		}
	}

	h.DB.Preload("Messages", func(db *gorm.DB) *gorm.DB {
		return db.Order("id asc")
	}).Preload("Patient").Preload("Doctor").First(&consult, consult.ID)
	h.attachDoctorProfile(&consult)

	h.ok(c, gin.H{
		"consultation": consult,
		"transcript":   userText,
		"reply_bn":     triage.ReplyBn,
		"reply_en":     triage.ReplyEn,
		"specialty":    triage.Specialty,
		"ready":        triage.Ready,
		"prefer_paid":  triage.PreferPaid,
		"source":       triage.Source,
		"audio_b64":    audioB64,
		"audio_mime":   mime,
	})
}

func (h *Handler) consultHistoryForLLM(consultID uint) []ai.ChatMessage {
	var msgs []models.ConsultMessage
	h.DB.Where("consultation_id = ?", consultID).Order("id asc").Limit(12).Find(&msgs)
	out := make([]ai.ChatMessage, 0, len(msgs))
	for _, m := range msgs {
		role := "assistant"
		if m.Role == "patient" {
			role = "user"
		}
		out = append(out, ai.ChatMessage{Role: role, Content: m.Content})
	}
	return out
}

func parseUintForm(s string) uint {
	var n uint
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0
		}
		n = n*10 + uint(ch-'0')
	}
	return n
}
