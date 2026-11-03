// Package feed はフィードの通知に添える日付入りの画像を作る。
// 下地 (og-base.png) は just fe-og-image、フォント (date-600.ttf) は just be-og-font で作る。
package feed

import (
	"bytes"
	_ "embed"
	"image"
	"image/color"
	"image/draw"
	"image/png"

	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

var (
	//go:embed og-base.png
	basePNG []byte
	//go:embed date-600.ttf
	fontTTF []byte
)

// ponytail: 大きさ・色・位置は仮の値 (specs/010 T033 で試作を見て決める)
const fontSize = 96

// global.css の --color-text (ライト)。トークンは Go から読めないので値を写す
var textColor = color.RGBA{0x1a, 0x1a, 0x1a, 0xff}

// Render は下地の中央に label を 1 行描いた PNG を返す。label の字はフォントのサブセットに含まれている前提
func Render(label string) ([]byte, error) {
	base, err := png.Decode(bytes.NewReader(basePNG))
	if err != nil {
		return nil, err
	}
	f, err := opentype.Parse(fontTTF)
	if err != nil {
		return nil, err
	}
	face, err := opentype.NewFace(f, &opentype.FaceOptions{Size: fontSize, DPI: 72, Hinting: font.HintingFull})
	if err != nil {
		return nil, err
	}
	defer face.Close()

	img := image.NewRGBA(base.Bounds())
	draw.Draw(img, img.Bounds(), base, image.Point{}, draw.Src)
	d := font.Drawer{Dst: img, Src: image.NewUniform(textColor), Face: face}
	m := face.Metrics()
	b := img.Bounds()
	d.Dot = fixed.Point26_6{
		X: (fixed.I(b.Dx()) - d.MeasureString(label)) / 2,
		Y: (fixed.I(b.Dy()) + m.Ascent - m.Descent) / 2,
	}
	d.DrawString(label)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
