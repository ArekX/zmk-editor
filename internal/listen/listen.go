// Package listen binds the HTTP listener, moving to the next port when the
// requested one is busy.
package listen

import (
	"errors"
	"fmt"
	"net"
	"strconv"
	"syscall"
	"time"
)

// WithPortFallback listens on addr, or on the first free port among the
// next attempts-1 ports. A port is also skipped when something already
// answers on it over loopback: on macOS a 127.0.0.1 bind can succeed while
// another process owns the wildcard address for the same port, and then
// "localhost" would reach that other process.
func WithPortFallback(addr string, attempts int) (net.Listener, error) {
	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, fmt.Errorf("invalid port %q", portStr)
	}
	if port == 0 {
		return net.Listen("tcp", addr)
	}
	for p := port; p < port+attempts; p++ {
		if inUse(p) {
			continue
		}
		ln, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(p)))
		if err == nil {
			return ln, nil
		}
		if !errors.Is(err, syscall.EADDRINUSE) {
			return nil, err
		}
	}
	return nil, fmt.Errorf("ports %d-%d are all in use", port, port+attempts-1)
}

func inUse(port int) bool {
	for _, host := range []string{"127.0.0.1", "::1"} {
		c, err := net.DialTimeout("tcp", net.JoinHostPort(host, strconv.Itoa(port)), 250*time.Millisecond)
		if err == nil {
			_ = c.Close()
			return true
		}
	}
	return false
}

// BrowserURL turns a listener address into a URL a browser can open.
func BrowserURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "http://" + addr
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, port)
}
