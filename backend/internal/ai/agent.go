package ai

import (
	"encoding/json"
	"strings"
)

type TriageResult struct {
	ReplyBn    string `json:"reply_bn"`
	ReplyEn    string `json:"reply_en"`
	Specialty  string `json:"specialty"`
	PreferPaid *bool  `json:"prefer_paid"`
	Ready      bool   `json:"ready"`
	SummaryBn  string `json:"summary_bn"`
	Source     string `json:"source"` // llm | rules
}

const triageSystem = `You are Sheba, a concise English telehealth triage assistant for a Bangladesh pharmacy app.
Gather symptoms, suggest a specialty, and ask free vs paid doctor preference.
Never invent prescriptions or diagnose definitively.
Return ONLY one compact JSON object (no markdown, no extra keys) with:
reply_en (1-2 short spoken English sentences),
reply_bn (optional short Bangla mirror; may match reply_en),
specialty (one of: General Physician, ENT, Dermatology, Cardiology, Gastroenterology, Endocrinology),
prefer_paid (true|false|null),
ready (true only when symptoms + free/paid preference are known),
summary_bn (short symptom summary, English OK).`

func Triage(llm *LLMClient, history []ChatMessage, userText string) TriageResult {
	msgs := []ChatMessage{{Role: "system", Content: triageSystem}}
	msgs = append(msgs, history...)
	if len(history) == 0 || history[len(history)-1].Role != "user" || history[len(history)-1].Content != userText {
		msgs = append(msgs, ChatMessage{Role: "user", Content: userText})
	}

	if llm != nil && llm.Enabled() {
		if raw, err := llm.ChatQuick(msgs, 220); err == nil {
			if parsed, ok := parseTriageJSON(raw); ok {
				parsed.Source = "llm"
				normalizeTriage(&parsed)
				return parsed
			}
			en := strings.TrimSpace(raw)
			if en != "" && !strings.Contains(strings.ToLower(en), "the user") {
				return TriageResult{
					ReplyEn:   en,
					ReplyBn:   en,
					Specialty: "General Physician",
					Source:    "llm",
				}
			}
		}
	}
	// Rules see the full patient thread so later turns keep earlier symptoms.
	return ruleTriage(combineUserText(history, userText))
}

func combineUserText(history []ChatMessage, userText string) string {
	parts := make([]string, 0, len(history)+1)
	for _, m := range history {
		if m.Role == "user" && strings.TrimSpace(m.Content) != "" {
			parts = append(parts, m.Content)
		}
	}
	if userText != "" && (len(parts) == 0 || parts[len(parts)-1] != userText) {
		parts = append(parts, userText)
	}
	return strings.Join(parts, " \n ")
}

func parseTriageJSON(raw string) (TriageResult, bool) {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start >= 0 && end > start {
		raw = raw[start : end+1]
	}
	var out TriageResult
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return TriageResult{}, false
	}
	if strings.TrimSpace(out.ReplyBn) == "" && strings.TrimSpace(out.ReplyEn) == "" {
		return TriageResult{}, false
	}
	return out, true
}

func normalizeTriage(t *TriageResult) {
	if t.Specialty == "" {
		t.Specialty = "General Physician"
	}
	if t.ReplyEn == "" && t.ReplyBn != "" {
		t.ReplyEn = t.ReplyBn
	}
	if t.ReplyBn == "" && t.ReplyEn != "" {
		t.ReplyBn = t.ReplyEn
	}
}

// PrimaryReply returns the language-preferred agent reply (English-first).
func PrimaryReply(t TriageResult, lang string) string {
	lang = strings.ToLower(strings.TrimSpace(lang))
	if lang == "bn" {
		if t.ReplyBn != "" {
			return t.ReplyBn
		}
		return t.ReplyEn
	}
	if t.ReplyEn != "" {
		return t.ReplyEn
	}
	return t.ReplyBn
}

func ruleTriage(text string) TriageResult {
	lower := strings.ToLower(text)
	specialty := "General Physician"
	hints := []string{}
	add := func(h string) {
		for _, x := range hints {
			if x == h {
				return
			}
		}
		hints = append(hints, h)
	}
	if containsAny(lower, "জ্বর", "fever", "জর") {
		add("fever")
	}
	if containsAny(lower, "কাশ", "cough", "সর্দি", "cold", "throat", "sore throat", "ent") {
		add("cough")
		specialty = "ENT"
	}
	if containsAny(lower, "পেট", "বমি", "diarrhea", "গ্যাস্ট্রিক", "stomach", "vomit") {
		add("stomach")
		specialty = "Gastroenterology"
	}
	if containsAny(lower, "চামড়া", "rash", "skin") {
		add("skin")
		specialty = "Dermatology"
	}
	if containsAny(lower, "ডায়াবেটিস", "diabetes", "সুগার") {
		add("diabetes")
		specialty = "Endocrinology"
	}
	if containsAny(lower, "ব্লাড প্রেসার", "blood pressure", "bp", "hypertension") {
		add("blood pressure")
		specialty = "Cardiology"
	}

	var prefer *bool
	if containsAny(lower, "ফ্রি", "free", "বিনামূল্যে") {
		f := false
		prefer = &f
	}
	if containsAny(lower, "পেইড", "paid", "ফি") {
		t := true
		prefer = &t
	}

	ready := len(hints) > 0 && prefer != nil
	replyEn := "Please share how long you have had symptoms, and whether you want a free or paid doctor."
	if len(hints) > 0 && prefer == nil {
		replyEn = "Thanks. I noted: " + strings.Join(hints, ", ") + ". Do you want a free doctor or a paid specialist?"
	}
	if ready {
		fee := "free"
		if prefer != nil && *prefer {
			fee = "paid"
		}
		replyEn = "Summary ready: " + strings.Join(hints, ", ") + ". Specialty " + specialty + ". Preference: " + fee + ". You can match a doctor now."
	}
	return TriageResult{
		ReplyBn:    replyEn,
		ReplyEn:    replyEn,
		Specialty:  specialty,
		PreferPaid: prefer,
		Ready:      ready,
		SummaryBn:  strings.Join(hints, ", "),
		Source:     "rules",
	}
}

func containsAny(s string, words ...string) bool {
	for _, w := range words {
		if strings.Contains(s, strings.ToLower(w)) || strings.Contains(s, w) {
			return true
		}
	}
	return false
}
