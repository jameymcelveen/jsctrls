package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serve(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	NewAPI(store, 0).ServeHTTP(response, request)
	return response
}

var store *Store

func fresh() { store = NewStore() }

func TestListReturnsTheSeededNamesInIDOrder(t *testing.T) {
	fresh()
	response := serve(t, "GET", "/api/names", "")
	var names []Name
	if err := json.NewDecoder(response.Body).Decode(&names); err != nil {
		t.Fatal(err)
	}
	got := []string{}
	for _, n := range names {
		got = append(got, n.ID+":"+n.Name)
	}
	if strings.Join(got, ",") != "1:Ada,2:Grace,3:Katherine" {
		t.Fatalf("got %v", got)
	}
}

func TestCreateTrimsAndSetsLocation(t *testing.T) {
	fresh()
	response := serve(t, "POST", "/api/names", `{"name":"  Iris  "}`)
	if response.Code != http.StatusCreated || response.Header().Get("Location") != "/api/names/4" {
		t.Fatalf("got %d %q", response.Code, response.Header().Get("Location"))
	}
	if !strings.Contains(response.Body.String(), `"name":"Iris"`) {
		t.Fatalf("body %s", response.Body.String())
	}
}

func TestInvalidNamesAreBadRequestProblems(t *testing.T) {
	fresh()
	for _, body := range []string{`{"name":"   "}`, `{}`, `not json`, `{"name":"` + strings.Repeat("a", 101) + `"}`} {
		response := serve(t, "POST", "/api/names", body)
		if response.Code != http.StatusBadRequest || response.Header().Get("Content-Type") != "application/problem+json" {
			t.Fatalf("%s: got %d %s", body, response.Code, response.Header().Get("Content-Type"))
		}
	}
}

func TestMissingIDsAreNotFoundProblems(t *testing.T) {
	fresh()
	for _, method := range []string{"GET", "PATCH", "DELETE"} {
		response := serve(t, method, "/api/names/missing", `{"name":"Ada"}`)
		if response.Code != http.StatusNotFound || !strings.Contains(response.Body.String(), "Name not found: missing") {
			t.Fatalf("%s: got %d %s", method, response.Code, response.Body.String())
		}
	}
}

func TestIDsSortNumerically(t *testing.T) {
	fresh()
	for i := 0; i < 7; i++ {
		serve(t, "POST", "/api/names", `{"name":"x"}`)
	}
	response := serve(t, "GET", "/api/names", "")
	var names []Name
	_ = json.NewDecoder(response.Body).Decode(&names)
	if last := names[len(names)-1].ID; last != "10" {
		t.Fatalf("last id %s", last)
	}
}
