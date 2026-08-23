package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"commit/backend/models"

	"github.com/robfig/cron/v3"
)

// reminderLocation is loaded exactly once. Every cron computation in this
// feature uses this Location; nothing in the reminder code relies on the
// server's OS-default timezone.
var reminderLocation = loadReminderLocation()

func loadReminderLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Kathmandu")
	if err != nil {
		log.Fatalf("load reminder timezone: %v", err)
	}
	return loc
}

// reminderTZSpec prefixes a raw cron expression with the feature timezone so
// robfig/cron parses the schedule in Asia/Kathmandu no matter what the server's
// OS-default timezone is (the parser only honors TZ=, CRON_TZ=, or time.Local).
const reminderTZSpec = "TZ=Asia/Kathmandu "

// reminderCronParser parses the standard 5-field cron expressions the frontend
// produces (no seconds, no descriptors).
var reminderCronParser = cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)

type CreateReminderInput struct {
	UserID string
	NoteID string
	Type   string
	// FireAt is the concrete datetime for one_time reminders.
	FireAt *time.Time
	// Cron is the standard 5-field cron expression for recurring reminders.
	Cron    string
	Message string
}

type UpdateReminderInput struct {
	UserID string
	ID     string
	// Cron, when non-empty, reschedules this reminder to the next occurrence.
	Cron     string
	Message  *string
	IsActive *bool
}

type ReminderService struct {
	reminders models.ReminderModel
	email     EmailSender
	appURL    string
}

func NewReminderService(reminders models.ReminderModel, email EmailSender, appURL string) ReminderService {
	return ReminderService{reminders: reminders, email: email, appURL: appURL}
}

func (service ReminderService) ListByNote(ctx context.Context, userID string, noteID string) ([]models.Reminder, error) {
	return service.reminders.ListByNote(ctx, userID, noteID)
}

func (service ReminderService) DueInWindow(ctx context.Context, userID string, since time.Time, limit int) ([]models.Reminder, error) {
	return service.reminders.DueInWindow(ctx, userID, since, limit)
}

func (service ReminderService) Create(ctx context.Context, input CreateReminderInput) (models.Reminder, error) {
	nextFireAt, err := service.computeInitialFireAt(input)
	if err != nil {
		return models.Reminder{}, err
	}

	var cronPtr *string
	if input.Type == "recurring" {
		cronPtr = &input.Cron
	}

	return service.reminders.Create(ctx, models.CreateReminderParams{
		UserID:     input.UserID,
		NoteID:     input.NoteID,
		Type:       input.Type,
		NextFireAt: nextFireAt,
		Cron:       cronPtr,
		Message:    input.Message,
	})
}

func (service ReminderService) Update(ctx context.Context, input UpdateReminderInput) (models.Reminder, error) {
	existing, err := service.reminders.GetByID(ctx, input.UserID, input.ID)
	if err != nil {
		return models.Reminder{}, err
	}

	var nextFireAt *time.Time
	if input.Cron != "" {
		if _, err := nextOccurrence(time.Now(), input.Cron); err != nil {
			return models.Reminder{}, fmt.Errorf("invalid cron: %w", err)
		}
		next, err := nextOccurrence(time.Now(), input.Cron)
		if err != nil {
			return models.Reminder{}, err
		}
		nextFireAt = &next
	}

	params := models.UpdateReminderParams{
		UserID:     input.UserID,
		ID:         input.ID,
		NextFireAt: nextFireAt,
		Cron:       service.cronValue(existing, input.Cron),
		Message:    input.Message,
		IsActive:   input.IsActive,
	}
	return service.reminders.Update(ctx, params)
}

func (service ReminderService) Delete(ctx context.Context, userID string, id string) error {
	return service.reminders.Delete(ctx, userID, id)
}

// ProcessDue claims all currently due reminders atomically, then sends one
// email per claimed reminder. Email failures are logged and swallowed: the
// reminder was already rescheduled/deactivated by the claim, so a failed send
// is one missed notification, never a stuck or duplicate one.
func (service ReminderService) ProcessDue(ctx context.Context, now time.Time, limit int) error {
	claimed, err := service.reminders.ClaimDue(ctx, now, limit, nextOccurrenceCallback)
	if err != nil {
		return err
	}

	for _, reminder := range claimed {
		subject := fmt.Sprintf("Reminder: %s", reminder.NoteTitle)
		body := reminderMessageHTML(service, reminder)
		if err := service.email.SendReminder(reminder.UserEmail, subject, body); err != nil {
			log.Printf("send reminder email %s (note %s): %v", reminder.ID, reminder.NoteID, err)
			continue
		}
	}

	return nil
}

func (service ReminderService) computeInitialFireAt(input CreateReminderInput) (time.Time, error) {
	switch input.Type {
	case "one_time":
		if input.FireAt == nil {
			return time.Time{}, fmt.Errorf("fire_at is required for one_time reminders")
		}
		return *input.FireAt, nil

	case "recurring":
		if input.Cron == "" {
			return time.Time{}, fmt.Errorf("cron is required for recurring reminders")
		}
		return nextOccurrence(time.Now(), input.Cron)

	default:
		return time.Time{}, fmt.Errorf("invalid reminder type: %q", input.Type)
	}
}

// cronValue resolves the cron to write on update. Cron rescheduling only makes
// sense for recurring reminders (enforced by the CHECK constraint): if the
// existing reminder is recurring and a new cron was supplied, use it; otherwise
// preserve the stored value.
func (service ReminderService) cronValue(existing models.Reminder, supplied string) *string {
	if supplied != "" {
		return &supplied
	}
	return existing.Cron
}

// nextOccurrence returns the first activation of cronSpec strictly after base,
// computed in reminderLocation. This is call site (b) for the feature:
// schedule.Next(t) evaluated against the Location loaded in
// loadReminderLocation, via the TZ= prefix on the parsed spec.
func nextOccurrence(base time.Time, cronSpec string) (time.Time, error) {
	schedule, err := reminderCronParser.Parse(reminderTZSpec + cronSpec)
	if err != nil {
		return time.Time{}, err
	}
	return schedule.Next(base.In(reminderLocation)), nil
}

// nextOccurrenceCallback adapts nextOccurrence to the model's computeNext
// signature (base time from the row being claimed).
func nextOccurrenceCallback(nextFireAt time.Time, cron *string) time.Time {
	if cron == nil {
		return nextFireAt
	}
	next, err := nextOccurrence(nextFireAt, *cron)
	if err != nil {
		log.Printf("compute next occurrence for %q: %v; keeping current fire time", *cron, err)
		return nextFireAt
	}
	return next
}

func reminderMessageHTML(service ReminderService, reminder models.Reminder) string {
	kind := "one-time reminder"
	if reminder.Type == "recurring" {
		kind = "recurring reminder"
	}
	message := reminder.Message
	if message == "" {
		message = "You set a reminder on this note."
	}
	openURL := service.appURL + "/notes/" + reminder.NoteID
	return fmt.Sprintf(`<p>%s</p>
<p><a href="%s">Open note: %s</a></p>
<p>This is a %s.</p>`, message, openURL, reminder.NoteTitle, kind)
}

// StartReminderScheduler runs the reminder dispatch loop on an interval ticker,
// mirroring the existing background tickers (metrics.StartDBStatsCollector,
// RateLimiter.cleanup). Each tick atomically claims up to due reminders and
// emails them; concurrent ticks can't double-fire thanks to the
// FOR UPDATE SKIP LOCKED claim inside ReminderModel.ClaimDue.
func StartReminderScheduler(service ReminderService) {
	const claimLimit = 100
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			err := service.ProcessDue(ctx, time.Now(), claimLimit)
			cancel()
			if err != nil {
				log.Printf("reminder scheduler tick failed: %v", err)
			}
		}
	}()
}
