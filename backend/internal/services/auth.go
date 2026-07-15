package services

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"mobile-ops/internal/config"
	"mobile-ops/internal/models"
)

type AuthService struct {
	cfg config.SecurityConfig
}

func NewAuthService(cfg config.SecurityConfig) *AuthService {
	return &AuthService{cfg: cfg}
}

type Claims struct {
	UserID   int64  `json:"uid"`
	Username string `json:"un"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func (a *AuthService) GenerateToken(u *models.User) (string, error) {
	claims := &Claims{
		UserID:   u.ID,
		Username: u.Username,
		Role:     u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(a.cfg.JWTTTLHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "mobile-ops",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(a.cfg.JWTSecret))
}

func (a *AuthService) ParseToken(tokenStr string) (*Claims, error) {
	tok, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(a.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if c, ok := tok.Claims.(*Claims); ok && tok.Valid {
		return c, nil
	}
	return nil, errors.New("invalid token")
}

func HashPassword(pw string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(h), err
}

func VerifyPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}
