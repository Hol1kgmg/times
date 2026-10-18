package main

import (
	"strings"
	"testing"
)

func TestParse(t *testing.T) {
	src := `１日目
IT系

- [a](https://a.example)
  - [a1](https://a.example/1)
  - [a2](https://a.example/2)
UI系
- [b](https://b.example)

2日目
その他
- [c [x]](https://c.example)
`
	days, err := parse(strings.NewReader(src))
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 2 || days[0].n != 1 || days[1].n != 2 {
		t.Fatalf("days = %+v", days)
	}
	d1 := days[0]
	if len(d1.categories) != 2 || d1.categories[0].name != "IT系" || d1.categories[1].name != "UI系" {
		t.Fatalf("categories = %+v", d1.categories)
	}
	a := d1.categories[0].items
	if len(a) != 1 || a[0].url != "https://a.example" || len(a[0].children) != 2 || a[0].children[1].title != "a2" {
		t.Fatalf("items = %+v", a)
	}
	if got := days[1].categories[0].items[0].title; got != "c [x]" {
		t.Fatalf("title = %q", got)
	}
}

func TestParseErrors(t *testing.T) {
	for _, src := range []string{
		"",
		"IT系\n- [a](https://a)\n",
		"1日目\n- [a](https://a)\n",
		"1日目\nIT系\n  - [a](https://a)\n",
	} {
		if _, err := parse(strings.NewReader(src)); err == nil {
			t.Errorf("expected error for %q", src)
		}
	}
}
