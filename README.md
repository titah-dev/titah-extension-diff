# titah-extension-diff

Editor-style git diff panel for Titah. Line numbers, colours, and — the point of
it — block a range of lines and send it to the main prompt.

Requires Titah with extension API `^0.5.0`.

## What it looks like

```
─ src/core/agent.ts ─────────────────────────────────
        ⋯ 4
  4  4      return load()
  5  5    }
  6  6
     7 ▌+ export function summarize(sep) {
     8 ▌+   return turns().map((t) => t.text).join(sep)
›    9 ▌+ }
    10  +
  7 11    export function count() {

VISUAL 3 lines · y send · v cancel
```

Press `y` and your prompt becomes `@src/core/agent.ts:7-9 `, with the cursor
right after it. Type *"add a doc comment for this function"* and send.

## Why a reference and not the diff text

What lands in the prompt is the **address**, not the code. The agent reads the
file itself with the tools it already has, so blocking a hundred lines costs the
same as blocking three — and the agent sees the file as it is *now*, not a
snapshot that goes stale the moment anything else edits it.

## Features

- **Unified diff against `HEAD`** — everything that differs from the last
  commit, staged or not, each hunk exactly once.
- **Gutter with old/new line numbers**, additions green, deletions red, file
  headers as section rules. The gutter **hides itself on narrow panels**: at the
  default 20-column width it would leave no room for the code. Widen with `+`
  and it comes back.
- **Visual selection** — `v` to anchor, `↑↓` to extend, `y` to send. `y` without
  a selection sends the line under the cursor.
- **Click to move the cursor**, and to extend a selection while visual mode is on.
- **Refresh**: `r`, plus automatic refresh on prompt send, turn end, and panel open.

## Installation

```jsonc
{
  "extension": {
    "@titah/extension-diff": {
      "side": "right",
      "key": "<leader>d",
      "options": {
        "gitDiffLimit": 200,
        "contextLines": 3,
        "showWhitespace": false
      }
    }
  },
  // Worth widening: the gutter needs the room, and the default is 20.
  "panel": { "right": { "width": 64 } }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gitDiffLimit` | number | 200 | Maximum diff lines to read |
| `contextLines` | number | 3 | Context lines for `git diff -U` |
| `showWhitespace` | boolean | false | `false` passes `--ignore-space-change` |

## Keybindings

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move the cursor; extend the selection when visual mode is on |
| `v` | Start a selection, or cancel the one you have |
| `y` | Send the selection (or the cursor line) to the prompt |
| `r` | Manual refresh |

`Esc` is **not** a cancel key here — Titah intercepts it to release panel focus,
so it never reaches the panel. `v` cancels instead. `+`, `-` and `=` are
likewise reserved by Titah, for panel width.

## Known limits

- **Untracked files don't appear.** `git diff` doesn't see them, and rendering a
  whole new file as one giant hunk would push every other change past
  `gitDiffLimit`.
- **A selection is dropped when the diff itself changes.** The panel refreshes at
  the end of every agent turn, and a selection anchored to lines that have since
  moved would send a reference to the wrong place — silently, which is worse
  than losing the selection.
- **No syntax highlighting.** A panel row carries one colour for the whole line;
  per-token colour would need spans in the host contract.

## Development

```bash
npm install
npm run build
npm test
```

## License

Apache-2.0
