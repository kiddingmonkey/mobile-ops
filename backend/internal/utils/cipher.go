package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// AES-256-GCM 加密/解密工具
// 用于保护 kubeconfig / AK-SK / Grafana Token 等敏感字段
type Cipher struct {
	gcm cipher.AEAD
}

func NewCipher(key string) (*Cipher, error) {
	if len(key) != 32 {
		return nil, errors.New("key must be 32 bytes for AES-256")
	}
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Cipher{gcm: gcm}, nil
}

func (c *Cipher) Encrypt(plaintext string) ([]byte, error) {
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return c.gcm.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

func (c *Cipher) Decrypt(ciphertext []byte) (string, error) {
	ns := c.gcm.NonceSize()
	if len(ciphertext) < ns {
		return "", errors.New("ciphertext too short")
	}
	nonce, data := ciphertext[:ns], ciphertext[ns:]
	pt, err := c.gcm.Open(nil, nonce, data, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}

func (c *Cipher) EncryptToString(plaintext string) (string, error) {
	ct, err := c.Encrypt(plaintext)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(ct), nil
}

func (c *Cipher) DecryptFromString(s string) (string, error) {
	ct, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return "", err
	}
	return c.Decrypt(ct)
}
