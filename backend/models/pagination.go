package models

const (
	DefaultLimit = 20
	MaxLimit     = 100
)

type PaginatedResult[T any] struct {
	Data   []T   `json:"data"`
	Total  int   `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}
