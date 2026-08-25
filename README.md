# titah-extension-diff

Diff panel for Titah — shows git diff and session changes in a tabbed right-side panel.

## Features

- **Git Diff tab**: Unified diff from `git diff HEAD` (unstaged) + `git diff --cached` (staged)
- **Session Changes tab**: In-memory tracking of files modified during the current Titah session
- **Tabbed interface**: Switch with `Tab` / `Shift+Tab`
- **Scrollable**: Up/Down arrows, cursor per tab
- **Refresh**: `r` key, auto-refresh on prompt send, turn end, panel open

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
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gitDiffLimit` | number | 200 | Maximum diff lines to display |
| `contextLines` | number | 3 | Context lines for `git diff -U` |
| `showWhitespace` | boolean | false | Whether to ignore whitespace changes |

## Keybindings

| Key | Action |
|-----|--------|
| `Tab` | Next tab |
| `Shift+Tab` | Previous tab |
| `↑` / `↓` | Move cursor |
| `r` | Manual refresh |

## Development

```bash
npm install
npm run build
npm test
```

## License

Apache-2.0