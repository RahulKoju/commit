package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type EmailSender interface {
	SendPasswordReset(toEmail string, resetURL string) error
}

type ResendSender struct {
	apiKey string
	from   string
}

func NewResendSender(apiKey, from string) ResendSender {
	return ResendSender{apiKey: apiKey, from: from}
}

func (s ResendSender) SendPasswordReset(toEmail string, resetURL string) error {
	body, _ := json.Marshal(map[string]string{
		"from":    s.from,
		"to":      toEmail,
		"subject": "Reset your password",
		"html": fmt.Sprintf(`<p>Click the link below to reset your password:</p>
<p><a href="%s">%s</a></p>
<p>This link expires in 1 hour.</p>
<p>If you did not request this, you can safely ignore this email.</p>`, resetURL, resetURL),
	})

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("resend API: %s", resp.Status)
	}

	return nil
}

type LogSender struct{}

func NewLogSender() LogSender {
	return LogSender{}
}

func (s LogSender) SendPasswordReset(toEmail string, resetURL string) error {
	log.Printf("[EMAIL] To: %s | Reset link: %s", toEmail, resetURL)
	return nil
}
