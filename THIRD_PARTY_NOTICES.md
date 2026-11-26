# Third-party notices

## nickcoutsos/keymap-editor

ZMK Editor is based on [keymap-editor](https://github.com/nickcoutsos/keymap-editor) by Nick Coutsos. Its user interface concept and look (layer list, keyboard drawn from the physical layout, behavior tag plus legend on each key, key-unit geometry, the `info.json`-style layout format) are the model for this project, the built-in behavior list in `internal/zmkdata/behaviors.json` started from its behavior data, and `internal/zmkdata/keycodes.json` is its JSON copy of ZMK's key code table (see below). ZMK Editor is a new implementation (Go and TypeScript) and does not copy its source code.

```
MIT License

Copyright (c) 2021 Nick Coutsos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ZMK keycode and behavior data

`internal/zmkdata/keycodes.json` is keymap-editor's JSON copy (`api/services/zmk/data/zmk-keycodes.json`) of the key code table in the [ZMK](https://zmk.dev) documentation (`docs/src/data/hid.js`), including the `symbol` fields keymap-editor added. The ZMK data is copyright (c) 2020 The ZMK Contributors, MIT licensed; the full license text is in [internal/zmkdata/LICENSE](internal/zmkdata/LICENSE). keymap-editor's additions are under its MIT license above.

The behavior list in `internal/zmkdata/behaviors.json` started from keymap-editor's `zmk-behaviors.json`, which describes ZMK's built-in behaviors; it has since been extended (descriptions, encoder and macro behaviors, macro control steps).

## Demo keymap

`internal/keymap/testdata/corne.keymap` is the keymap of [nickcoutsos/keymap-editor-demo-crkbd](https://github.com/nickcoutsos/keymap-editor-demo-crkbd), used as a parser test fixture.

## Libraries

The Go and npm dependencies listed in `go.mod` and `frontend/zmk-editor-ui/package.json` are used under their own licenses.
