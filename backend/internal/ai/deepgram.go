package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

type DeepgramClient struct {
	APIKey     string
	STTModel   string
	STTLang    string
	TTSModel   string
}

func NewDeepgramFromEnv() *DeepgramClient {
	stt := os.Getenv("DEEPGRAM_STT_MODEL")
	if stt == "" {
		stt = "nova-2"
	}
	lang := os.Getenv("DEEPGRAM_STT_LANGUAGE")
	if lang == "" {
		lang = "bn"
	}
	tts := os.Getenv("DEEPGRAM_TTS_MODEL")
	if tts == "" {
		tts = "aura-2-thalia-en"
	}
	return &DeepgramClient{
		APIKey:   os.Getenv("DEEPGRAM_API_KEY"),
		STTModel: stt,
		STTLang:  lang,
		TTSModel: tts,
	}
}

func (d *DeepgramClient) Enabled() bool {
	return d != nil && d.APIKey != ""
}

func (d *DeepgramClient) Transcribe(audio []byte, contentType string) (string, error) {
	if !d.Enabled() {
		return "", fmt.Errorf("deepgram not configured")
	}
	if len(audio) == 0 {
		return "", fmt.Errorf("empty audio")
	}
	if contentType == "" {
		contentType = "audio/webm"
	}
	q := url.Values{}
	q.Set("model", d.STTModel)
	q.Set("smart_format", "true")
	q.Set("punctuate", "true")
	if d.STTLang != "" {
		q.Set("language", d.STTLang)
	}
	endpoint := "https://api.deepgram.com/v1/listen?" + q.Encode()
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(audio))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Token "+d.APIKey)
	req.Header.Set("Content-Type", contentType)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("deepgram stt http %d: %s", res.StatusCode, string(raw))
	}
	var parsed struct {
		Results struct {
			Channels []struct {
				Alternatives []struct {
					Transcript string `json:"transcript"`
				} `json:"alternatives"`
			} `json:"channels"`
		} `json:"results"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Results.Channels) == 0 || len(parsed.Results.Channels[0].Alternatives) == 0 {
		return "", nil
	}
	return strings.TrimSpace(parsed.Results.Channels[0].Alternatives[0].Transcript), nil
}

func (d *DeepgramClient) Speak(text string) ([]byte, string, error) {
	if !d.Enabled() {
		return nil, "", fmt.Errorf("deepgram not configured")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, "", fmt.Errorf("empty text")
	}
	q := url.Values{}
	q.Set("model", d.TTSModel)
	endpoint := "https://api.deepgram.com/v1/speak?" + q.Encode()
	body, _ := json.Marshal(map[string]string{"text": text})
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Token "+d.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "audio/mpeg")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return nil, "", err
	}
	if res.StatusCode >= 300 {
		return nil, "", fmt.Errorf("deepgram tts http %d: %s", res.StatusCode, string(raw))
	}
	ctype := res.Header.Get("Content-Type")
	if ctype == "" {
		ctype = "audio/mpeg"
	}
	return raw, ctype, nil
}
