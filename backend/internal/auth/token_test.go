package auth

import (
	"bytes"
	"testing"
)

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

func TestHash(t *testing.T) {
	h := Hash("abc")
	if len(h) != 32 || !bytes.Equal(h, Hash("abc")) || bytes.Equal(h, Hash("abd")) {
		t.Errorf("Hash must be deterministic 32 bytes: %x", h)
	}
}
