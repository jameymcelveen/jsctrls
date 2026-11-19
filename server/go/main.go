// Command server is the Go implementation of the jsctrls demo names API.
package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	port := env("SERVER_PORT", "8081")
	delayMs, err := strconv.Atoi(env("DEMO_DELAY_MS", "300"))
	if err != nil {
		log.Fatalf("DEMO_DELAY_MS must be a number: %v", err)
	}
	handler := NewAPI(NewStore(), time.Duration(delayMs)*time.Millisecond)
	log.Printf("names API (Go) listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}
