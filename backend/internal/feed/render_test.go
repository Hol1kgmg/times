package feed

import (
	"bytes"
	"image/png"
	"testing"
)

// 画像は OG と同じ 1200×630 で、中央に日付が描かれる (specs/010 FR-009)
func TestRenderDrawsDateAtCenter(t *testing.T) {
	out, err := Render("10月20日(火)")
	if err != nil {
		t.Fatal(err)
	}
	img, err := png.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	base, _ := png.Decode(bytes.NewReader(basePNG))
	if b := img.Bounds(); b.Dx() != 1200 || b.Dy() != 630 {
		t.Fatalf("size: got %v", b)
	}
	for x := 450; x < 750; x++ {
		for y := 280; y < 350; y++ {
			r1, g1, b1, _ := img.At(x, y).RGBA()
			r2, g2, b2, _ := base.At(x, y).RGBA()
			if r1 != r2 || g1 != g2 || b1 != b2 {
				return
			}
		}
	}
	t.Error("no pixel differs from the base around the center")
}
