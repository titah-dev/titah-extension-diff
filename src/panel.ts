import type { ExtensionFactory, View, ViewRow } from "titah-code/extension"
import { getGitDiff, isGitRepo } from "./git-diff.ts"
import { createSessionTracker } from "./session-tracker.ts"
import {
  TABS,
  type TabId,
  type TabRow,
  nextTab,
  prevTab,
  moveCursor,
  planTab,
  truncateEnd,
} from "./tabs.ts"

/**
 * Panel diff untuk Titah — tabbed view: Git Diff | Session Changes.
 *
 * Ditulis HANYA dengan `titah-code/extension`. Tidak ada akses ke internal Titah.
 */

interface Options {
  gitDiffLimit?: number
  contextLines?: number
  showWhitespace?: boolean
}

const EMPTY_LABELS: Record<TabId, string> = {
  git: "clean",
  session: "no session changes",
}

const factory: ExtensionFactory = ({ cwd, options }) => {
  const settings = options as Options
  const gitDiffLimit = Math.max(1, settings.gitDiffLimit ?? 200)
  const contextLines = Math.max(0, settings.contextLines ?? 3)
  const showWhitespace = settings.showWhitespace ?? false

  let activeTab: TabId = "git"
  const cursors: Record<TabId, number> = { git: 0, session: 0 }
  let contentLines: Record<TabId, number> = { git: 0, session: 0 }
  let drawn: TabRow[] = []

  const sessionTracker = createSessionTracker()

  return {
    title: "Diff",
    side: "right",
    key: "<leader>d",

    async render({ signal, width, rows }): Promise<View> {
      // Git diff
      let gitLines: string[] = []
      if (await isGitRepo(cwd, signal)) {
        gitLines = await getGitDiff({
          cwd,
          signal,
          contextLines,
          showWhitespace,
          limit: gitDiffLimit,
        })
      }

      // Session diffs
      const sessionDiffs = sessionTracker.getAllDiffs()
      const sessionLines: string[] = []
      for (const diff of sessionDiffs.values()) {
        sessionLines.push(...diff.split("\n"))
      }

      contentLines = {
        git: gitLines.length,
        session: sessionLines.length,
      }

      // Clamp cursor
      cursors[activeTab] = moveCursor(cursors[activeTab], 0, contentLines[activeTab])

      const innerWidth = Math.max(1, width - 2)

      const currentLines = activeTab === "git" ? gitLines : sessionLines
      drawn = planTab({
        rows,
        activeTab,
        cursor: cursors[activeTab],
        contentLines: contentLines[activeTab],
        content: currentLines,
        emptyLabel: EMPTY_LABELS[activeTab],
      })

      return { kind: "rows", rows: drawn.map((row) => drawRow(row, innerWidth)) }
    },

    onKey({ key }) {
      if (key === "tab") {
        activeTab = nextTab(activeTab)
        return { refresh: true }
      }
      if (key === "backtab" || key === "shift+tab") {
        activeTab = prevTab(activeTab)
        return { refresh: true }
      }
      if (key === "up" || key === "down") {
        const delta = key === "up" ? -1 : 1
        cursors[activeTab] = moveCursor(cursors[activeTab], delta, contentLines[activeTab])
        return { refresh: true }
      }
      if (key === "r") return { refresh: true }
      return undefined
    },

    onClick({ row }) {
      const target = drawn[row]
      if (target === undefined) return undefined

      // Click on tab switches to it
      if (target.kind === "tab") {
        if (target.tab === activeTab) return undefined
        activeTab = target.tab
        return { refresh: true }
      }
      // Click on content line moves cursor
      if (target.kind === "content") {
        // Find the actual index in the content (accounting for offset)
        // Since we don't have offset in the row, we'd need to track it
        // For now, just refresh - cursor movement via click is secondary
        return { refresh: true }
      }
      return undefined
    },
  }
}

/**
 * Render TabRow ke ViewRow.
 */
function drawRow(row: TabRow, width: number): ViewRow {
  switch (row.kind) {
    case "tab": {
      const text = row.active ? `▸ ${row.title} ◂` : `  ${row.title}  `
      return row.active ? { text, color: "cyan" } : { text, dim: true }
    }
    case "content":
      return row.cursor
        ? { text: `› ${truncateEnd(row.text, width - 2)}`, selected: true }
        : { text: `  ${truncateEnd(row.text, width - 2)}` }
    case "empty":
      return { text: `  ${row.text}`, dim: true }
    case "hint":
      return { text: row.text, dim: true }
  }
}

export default factory