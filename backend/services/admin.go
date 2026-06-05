package services

import (
	"context"

	"commit/backend/models"
)

type AdminService struct {
	users models.UserModel
}

func NewAdminService(users models.UserModel) AdminService {
	return AdminService{users: users}
}

func (service AdminService) ListUsers(ctx context.Context) ([]models.User, error) {
	return service.users.List(ctx)
}

func (service AdminService) DeleteUser(ctx context.Context, id string) error {
	return service.users.Delete(ctx, id)
}
