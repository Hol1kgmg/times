// Package auth は管理者 session のトークン・GitHub 照合・request context の principal を扱う。
// ADR: adr/backend/0007-issue-and-verify-sessions-in-backend.md
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// NewToken は 32 バイトの乱数を base64url (パディングなし、43 文字) で返す。平文はクライアントにだけ渡す。
func NewToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Hash は sessions.token_hash に保存・照合する値。
func Hash(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
