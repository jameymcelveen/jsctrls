package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Name is one row of the names API (specs/006-names-api).
type Name struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Store is the in-memory names repository. Safe for concurrent use.
type Store struct {
	mu     sync.Mutex
	names  map[string]Name
	nextID int
}

// NewStore returns a store seeded with Ada, Grace and Katherine.
func NewStore() *Store {
	s := &Store{names: map[string]Name{}, nextID: 1}
	for _, n := range []string{"Ada", "Grace", "Katherine"} {
		s.create(n)
	}
	return s
}

func (s *Store) create(name string) Name {
	n := Name{ID: strconv.Itoa(s.nextID), Name: name}
	s.nextID++
	s.names[n.ID] = n
	return n
}

// byID sorts numeric ids numerically, so "10" comes after "9".
func byID(a, b Name) int {
	ai, aErr := strconv.Atoi(a.ID)
	bi, bErr := strconv.Atoi(b.ID)
	if aErr == nil && bErr == nil {
		return ai - bi
	}
	return strings.Compare(a.ID, b.ID)
}

// API serves the names API and the health probe.
type API struct {
	store   *Store
	delay   time.Duration
	origins []string
}

// NewAPI wires the routes. delay slows each names call so a UI can show its busy states.
func NewAPI(store *Store, delay time.Duration) http.Handler {
	api := &API{store: store, delay: delay, origins: []string{"http://localhost:5173", "http://127.0.0.1:5173"}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /actuator/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "UP"})
	})
	mux.HandleFunc("GET /api/names", api.slow(api.list))
	mux.HandleFunc("POST /api/names", api.slow(api.create))
	mux.HandleFunc("GET /api/names/{id}", api.slow(api.get))
	mux.HandleFunc("PATCH /api/names/{id}", api.slow(api.update))
	mux.HandleFunc("DELETE /api/names/{id}", api.slow(api.remove))
	return api.cors(mux)
}

func (a *API) slow(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.delay > 0 {
			time.Sleep(a.delay)
		}
		next(w, r)
	}
}

func (a *API) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if slices.Contains(a.origins, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (a *API) list(w http.ResponseWriter, _ *http.Request) {
	a.store.mu.Lock()
	names := make([]Name, 0, len(a.store.names))
	for _, n := range a.store.names {
		names = append(names, n)
	}
	a.store.mu.Unlock()
	slices.SortFunc(names, byID)
	writeJSON(w, http.StatusOK, names)
}

func (a *API) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	a.store.mu.Lock()
	n, ok := a.store.names[id]
	a.store.mu.Unlock()
	if !ok {
		notFound(w, id)
		return
	}
	writeJSON(w, http.StatusOK, n)
}

func (a *API) create(w http.ResponseWriter, r *http.Request) {
	name, ok := readName(w, r)
	if !ok {
		return
	}
	a.store.mu.Lock()
	n := a.store.create(name)
	a.store.mu.Unlock()
	w.Header().Set("Location", "/api/names/"+n.ID)
	writeJSON(w, http.StatusCreated, n)
}

func (a *API) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	a.store.mu.Lock()
	_, exists := a.store.names[id]
	a.store.mu.Unlock()
	if !exists {
		notFound(w, id)
		return
	}
	name, ok := readName(w, r)
	if !ok {
		return
	}
	a.store.mu.Lock()
	defer a.store.mu.Unlock()
	n, exists := a.store.names[id]
	if !exists {
		notFound(w, id)
		return
	}
	n.Name = name
	a.store.names[id] = n
	writeJSON(w, http.StatusOK, n)
}

func (a *API) remove(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	a.store.mu.Lock()
	_, ok := a.store.names[id]
	delete(a.store.names, id)
	a.store.mu.Unlock()
	if !ok {
		notFound(w, id)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// readName decodes {"name": "..."}, trims it, and writes a 400 problem when it is invalid.
func readName(w http.ResponseWriter, r *http.Request) (string, bool) {
	var body struct {
		Name *string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == nil || strings.TrimSpace(*body.Name) == "" {
		problem(w, http.StatusBadRequest, "name: must not be blank")
		return "", false
	}
	if len([]rune(*body.Name)) > 100 {
		problem(w, http.StatusBadRequest, "name: size must be between 0 and 100")
		return "", false
	}
	return strings.TrimSpace(*body.Name), true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// problem writes an RFC 9457 problem detail.
func problem(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":   "about:blank",
		"title":  http.StatusText(status),
		"status": status,
		"detail": detail,
	})
}

func notFound(w http.ResponseWriter, id string) {
	problem(w, http.StatusNotFound, fmt.Sprintf("Name not found: %s", id))
}
