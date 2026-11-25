# Third-party notices

## nickcoutsos/keymap-editor

ZMK Editor is a successor to [keymap-editor](https://github.com/nickcoutsos/keymap-editor) by Nick Coutsos. Its user interface concept and look (layer list, keyboard drawn from the physical layout, behavior tag plus legend on each key, key-unit geometry, the `info.json`-style layout format) are the model for this project, and the built-in behavior list in `internal/zmkdata/behaviors.json` started from its behavior data. ZMK Editor is a new implementation (Go and TypeScript) and does not copy its source code.

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

`internal/zmkdata/keycodes.json` and the original behavior data come from the [ZMK](https://zmk.dev) documentation, copyright (c) 2020 The ZMK Contributors, MIT licensed. The full license text is in [internal/zmkdata/LICENSE](internal/zmkdata/LICENSE).

## Demo keymap

`internal/keymap/testdata/corne.keymap` is the keymap of [nickcoutsos/keymap-editor-demo-crkbd](https://github.com/nickcoutsos/keymap-editor-demo-crkbd), used as a parser test fixture.

## Libraries

The Go and npm dependencies listed in `go.mod` and `frontend/zmk-editor-ui/package.json` are used under their own licenses.
