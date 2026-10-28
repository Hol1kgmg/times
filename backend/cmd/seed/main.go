// seed は Markdown のダミーデータを開発 DB に入れる。`just db-seed` から呼ぶ。
//
// 形式: 「N日目」の行が digest の区切り、`- ` で始まらない行がカテゴリ、
// `- [title](url)` が記事 (`- 🔥 [title](url)` はホットトピック)、2 スペース以上の字下げで子記事。
// 日付は実行日基準で、最後の日が 1 日前になるようにずらす。
package main

import (
	"bufio"
	"cmp"
	"context"
	"fmt"
	"io"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type article struct {
	title, url string
	hot        bool
	children   []article
}

type category struct {
	name  string
	items []article
}

type day struct {
	n          int
	categories []category
}

var (
	dayRe  = regexp.MustCompile(`^(\d+)日目$`)
	linkRe = regexp.MustCompile(`^( *)- (🔥 )?\[(.+)\]\((\S+)\)$`)
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) != 2 {
		return fmt.Errorf("usage: seed <seed.md>")
	}
	f, err := os.Open(os.Args[1])
	if err != nil {
		return err
	}
	defer f.Close()
	days, err := parse(f)
	if err != nil {
		return err
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cmp.Or(os.Getenv("DATABASE_URL"), "postgres://times:times@localhost:5432/times?sslmode=disable"))
	if err != nil {
		return err
	}
	defer pool.Close()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := db.New(pool).WithTx(tx)
	// GitHub の ID は 1 始まりなので 0 は実在の管理者と衝突しない
	seeder, err := q.UpsertUser(ctx, db.UpsertUserParams{ID: 0, Login: "seed"})
	if err != nil {
		return err
	}

	y, m, d := time.Now().Date()
	today := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	last := days[len(days)-1].n
	for _, dy := range days {
		date := today.AddDate(0, 0, dy.n-last-1)
		// 同じ日付を入れ直せるように消してから入れる。articles と article_links は cascade で消える
		if _, err := tx.Exec(ctx, "DELETE FROM digests WHERE entry_date = $1", date); err != nil {
			return err
		}
		dg, err := q.CreateDigest(ctx, db.CreateDigestParams{EntryDate: date, CreatedBy: seeder.ID})
		if err != nil {
			return err
		}
		var pos int32
		insert := func(cat string, hot bool, a article) (db.Article, error) {
			row, err := q.CreateArticle(ctx, db.CreateArticleParams{DigestID: dg.ID, Position: pos, Category: cat, Title: a.title, Url: a.url, IsHot: hot, CreatedBy: seeder.ID})
			if err != nil {
				return row, fmt.Errorf("%d日目 %q: %w", dy.n, a.title, err)
			}
			pos++
			return row, nil
		}
		for _, c := range dy.categories {
			for _, a := range c.items {
				parent, err := insert(c.name, a.hot, a)
				if err != nil {
					return err
				}
				for j, ch := range a.children {
					child, err := insert(c.name, a.hot, ch)
					if err != nil {
						return err
					}
					if err := q.CreateArticleLink(ctx, db.CreateArticleLinkParams{ParentID: parent.ID, ChildID: child.ID, Position: int32(j)}); err != nil {
						return err
					}
				}
			}
		}
		fmt.Printf("%s: %d articles\n", date.Format(time.DateOnly), pos)
	}
	return tx.Commit(ctx)
}

func parse(r io.Reader) ([]day, error) {
	var days []day
	sc := bufio.NewScanner(r)
	for ln := 1; sc.Scan(); ln++ {
		line := strings.TrimRight(sc.Text(), " \t\r")
		if line == "" {
			continue
		}
		if m := dayRe.FindStringSubmatch(halfWidth(line)); m != nil {
			n, _ := strconv.Atoi(m[1])
			days = append(days, day{n: n})
			continue
		}
		if len(days) == 0 {
			return nil, fmt.Errorf("line %d: expected N日目 before %q", ln, line)
		}
		cur := &days[len(days)-1]
		m := linkRe.FindStringSubmatch(line)
		if m == nil {
			cur.categories = append(cur.categories, category{name: line})
			continue
		}
		if len(cur.categories) == 0 {
			return nil, fmt.Errorf("line %d: expected category before %q", ln, line)
		}
		cat := &cur.categories[len(cur.categories)-1]
		a := article{title: m[3], url: m[4], hot: m[2] != ""}
		if m[1] == "" {
			cat.items = append(cat.items, a)
			continue
		}
		if len(cat.items) == 0 {
			return nil, fmt.Errorf("line %d: child without parent %q", ln, line)
		}
		p := &cat.items[len(cat.items)-1]
		p.children = append(p.children, a)
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	if len(days) == 0 {
		return nil, fmt.Errorf("no N日目 found")
	}
	return days, nil
}

func halfWidth(s string) string {
	return strings.Map(func(r rune) rune {
		if '０' <= r && r <= '９' {
			return r - '０' + '0'
		}
		return r
	}, s)
}
