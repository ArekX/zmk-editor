// Package zmkdata embeds the built-in ZMK behavior and keycode catalogues
// served to the UI. keycodes.json is the ZMK documentation's keycode list
// (MIT, see LICENSE), as shipped by nickcoutsos/keymap-editor;
// behaviors.json started from that project's behavior list and is
// maintained here.
package zmkdata

import _ "embed"

//go:embed behaviors.json
var Behaviors []byte

//go:embed keycodes.json
var Keycodes []byte
