package auth

import (
	"bytes"
	"testing"
)

// session のトークンは 32 バイトの乱数を base64url にした 43 文字で、毎回違う
func TestNewToken(t *testing.T) {
	a, err := NewToken()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := NewToken()
	if len(a) != 43 || len(b) != 43 || a == b {
		t.Errorf("got %q and %q, want two distinct 43-char tokens", a, b)
	}
}

// DB に置くのはトークンの sha256 (32 バイト) で、同じトークンからは同じ値になる
func TestHash(t *testing.T) {
	h := Hash("abc")
	if len(h) != 32 || !bytes.Equal(h, Hash("abc")) || bytes.Equal(h, Hash("abd")) {
		t.Errorf("Hash must be deterministic 32 bytes: %x", h)
	}
}
