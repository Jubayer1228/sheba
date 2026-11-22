package ai

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type LLMClient struct {
	BaseURL string
	APIKey  string
	Model   string
	Timeout time.Duration
}

func NewLLMFromEnv() *LLMClient {
	timeoutSec, _ := strconv.Atoi(os.Getenv("LLM_TIMEOUT_SEC"))
	if timeoutSec <= 0 {
		timeoutSec = 90
	}
	base := strings.TrimRight(os.Getenv("LLM_BASE_URL"), "/")
	if base == "" {
		base = "https://llm.robinailabs.com/v1"
	}
	model := os.Getenv("LLM_MODEL")
	if model == "" {
		model = "Ornith-1.5"
	}
	return &LLMClient{
		BaseURL: base,
		APIKey:  os.Getenv("LLM_API_KEY"),
		Model:   model,
		Timeout: time.Duration(timeoutSec) * time.Second,
	}
}

func (c *LLMClient) Enabled() bool {
	return c != nil && c.APIKey != "" && c.BaseURL != ""
}

func (c *LLMClient) Chat(messages []ChatMessage, maxTokens int) (string, error) {
	return c.chatWithTimeout(messages, maxTokens, c.Timeout)
}

// ChatQuick tries the LLM briefly so live chat can fall back to rules without long stalls.
func (c *LLMClient) ChatQuick(messages []ChatMessage, maxTokens int) (string, error) {
	limit := 12 * time.Second
	if sec := os.Getenv("LLM_CHAT_TIMEOUT_SEC"); sec != "" {
		if n, err := strconv.Atoi(sec); err == nil && n > 0 {
			limit = time.Duration(n) * time.Second
		}
	}
	if c.Timeout > 0 && c.Timeout < limit {
		limit = c.Timeout
	}
	return c.chatWithTimeout(messages, maxTokens, limit)
}

func (c *LLMClient) chatWithTimeout(messages []ChatMessage, maxTokens int, timeout time.Duration) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("llm not configured")
	}
	if maxTokens <= 0 {
		maxTokens = 500
	}
	if timeout <= 0 {
		timeout = 90 * time.Second
	}
	payload := map[string]interface{}{
		"model":       c.Model,
		"messages":    messages,
		"max_tokens":  maxTokens,
		"temperature": 0.2,
		"stream":      true,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("User-Agent", "ShebaCare/1.0")

	client := &http.Client{Timeout: timeout}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 800))
		return "", fmt.Errorf("llm http %d: %s", res.StatusCode, string(b))
	}

	var content strings.Builder
	var reasoning strings.Builder
	sc := bufio.NewScanner(res.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	scanErr := error(nil)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content   string `json:"content"`
					Reasoning string `json:"reasoning"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		if chunk.Choices[0].Delta.Content != "" {
			content.WriteString(chunk.Choices[0].Delta.Content)
		}
		if chunk.Choices[0].Delta.Reasoning != "" {
			reasoning.WriteString(chunk.Choices[0].Delta.Reasoning)
		}
	}
	scanErr = sc.Err()
	out := strings.TrimSpace(content.String())
	if out == "" {
		// Prefer not to return raw chain-of-thought; only use if it looks like final Bangla/JSON.
		r := strings.TrimSpace(reasoning.String())
		if strings.Contains(r, "{") || containsBangla(r) {
			out = r
		}
	}
	if out == "" {
		if scanErr != nil {
			return "", scanErr
		}
		return "", fmt.Errorf("empty llm response")
	}
	return out, nil
}

func containsBangla(s string) bool {
	for _, r := range s {
		if r >= 0x0980 && r <= 0x09FF {
			return true
		}
	}
	return false
}
