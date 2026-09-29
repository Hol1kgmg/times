package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Hol1kgmg/times/backend/internal/apperr"
)

// Client は GitHub OAuth の code を GitHub ユーザーに引き換える。BaseURL / APIURL はテストでモックに向ける。
type Client struct {
	HTTP                   *http.Client
	BaseURL, APIURL        string
	ClientID, ClientSecret string
}

type User struct {
	ID    int64
	Login string
}

// Exchange は code を access_token に交換し、その token で /user を読む。access_token は保存しない。
// 通信失敗・非 2xx・JSON 不正・GitHub の error 応答はすべて apperr.UpstreamFailed (502)。
func (c Client) Exchange(ctx context.Context, code, redirectURI string) (User, error) {
	body, _ := json.Marshal(map[string]string{
		"client_id": c.ClientID, "client_secret": c.ClientSecret, "code": code, "redirect_uri": redirectURI,
	})
	var tok struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := c.do(ctx, http.MethodPost, c.BaseURL+"/login/oauth/access_token", "", bytes.NewReader(body), &tok); err != nil {
		return User{}, err
	}
	if tok.Error != "" || tok.AccessToken == "" {
		return User{}, apperr.UpstreamFailed("github token exchange failed: " + tok.Error)
	}
	var u User
	if err := c.do(ctx, http.MethodGet, c.APIURL+"/user", tok.AccessToken, nil, &u); err != nil {
		return User{}, err
	}
	if u.ID == 0 || u.Login == "" {
		return User{}, apperr.UpstreamFailed("github user response is incomplete")
	}
	return u, nil
}

func (c Client) do(ctx context.Context, method, url, bearer string, body *bytes.Reader, out any) error {
	var r *http.Request
	var err error
	if body == nil {
		r, err = http.NewRequestWithContext(ctx, method, url, nil)
	} else {
		r, err = http.NewRequestWithContext(ctx, method, url, body)
	}
	if err != nil {
		return apperr.UpstreamFailed(err.Error())
	}
	r.Header.Set("Accept", "application/json")
	r.Header.Set("User-Agent", "times-backend")
	if body != nil {
		r.Header.Set("Content-Type", "application/json")
	}
	if bearer != "" {
		r.Header.Set("Authorization", "Bearer "+bearer)
	}
	res, err := c.HTTP.Do(r)
	if err != nil {
		return apperr.UpstreamFailed("github request failed: " + err.Error())
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return apperr.UpstreamFailed(fmt.Sprintf("github returned %d for %s", res.StatusCode, method+" "+url))
	}
	if err := json.NewDecoder(res.Body).Decode(out); err != nil {
		return apperr.UpstreamFailed("github response is not json: " + err.Error())
	}
	return nil
}
