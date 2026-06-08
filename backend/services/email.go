package services

import (
	"fmt"
	"log"
	"net/smtp"
)

type EmailSender interface {
	SendPasswordReset(toEmail string, resetURL string) error
}

type SmtpSender struct {
	host     string
	port     string
	username string
	password string
	from     string
	appURL   string
}

func NewSmtpSender(host, port, username, password, from, appURL string) SmtpSender {
	return SmtpSender{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
		appURL:   appURL,
	}
}

func (s SmtpSender) SendPasswordReset(toEmail string, resetURL string) error {
	subject := "Subject: Password Reset\n"
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	body := fmt.Sprintf(`<p>Click the link below to reset your password:</p>
<p><a href="%s">%s</a></p>
<p>This link expires in 1 hour.</p>
<p>If you did not request this, you can safely ignore this email.</p>`, resetURL, resetURL)

	msg := []byte("From: " + s.from + "\n" +
		"To: " + toEmail + "\n" +
		subject + mime + body)

	addr := s.host + ":" + s.port
	auth := smtp.PlainAuth("", s.username, s.password, s.host)

	if err := smtp.SendMail(addr, auth, s.from, []string{toEmail}, msg); err != nil {
		return fmt.Errorf("send email: %w", err)
	}

	return nil
}

type LogSender struct {
	appURL string
}

func NewLogSender(appURL string) LogSender {
	return LogSender{appURL: appURL}
}

func (s LogSender) SendPasswordReset(toEmail string, resetURL string) error {
	log.Printf("[EMAIL] To: %s | Reset link: %s", toEmail, resetURL)
	return nil
}
