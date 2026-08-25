/**
 * In-memory tracker untuk perubahan sesi.
 *
 * Menyimpan konten asli file saat pertama kali dilacak, dan konten terbaru.
 * Diff dihitung on-demand menggunakan algoritma unified diff sederhana.
 */

export interface FileSnapshot {
  originalContent: string
  currentContent: string
}

export interface SessionTracker {
  recordRead(filepath: string, content: string): void
  recordWrite(filepath: string, content: string): void
  getDiff(filepath: string): string | undefined
  getAllDiffs(): Map<string, string>
  hasChanges(): boolean
  clear(): void
}

function computeUnifiedDiff(original: string, current: string, contextLines = 3): string {
  const origLines = original.split("\n")
  const currLines = current.split("\n")

  // Simple LCS-based diff (Myers algorithm would be better but this works for small files)
  const diff = simpleDiff(origLines, currLines, contextLines)
  return diff.join("\n")
}

/**
 * Simple diff algorithm - returns unified diff lines.
 * Not production-grade but sufficient for session tracking display.
 */
function simpleDiff(orig: string[], curr: string[], context: number): string[] {
  const result: string[] = []
  let i = 0, j = 0

  // Find common prefix
  while (i < orig.length && j < curr.length && orig[i] === curr[j]) {
    i++
    j++
  }

  // Find common suffix (not overlapping with prefix)
  let origEnd = orig.length
  let currEnd = curr.length
  while (origEnd > i && currEnd > j && orig[origEnd - 1] === curr[currEnd - 1]) {
    origEnd--
    currEnd--
  }

  const origChanged = orig.slice(i, origEnd)
  const currChanged = curr.slice(j, currEnd)

  if (origChanged.length === 0 && currChanged.length === 0) {
    return []
  }

  // Build unified diff header
  const origStart = i + 1
  const origCount = origEnd - i
  const currStart = j + 1
  const currCount = currEnd - j

  result.push(`@@ -${origStart},${origCount} +${currStart},${currCount} @@`)

  // Add context before
  const contextStart = Math.max(0, i - context)
  for (let k = contextStart; k < i; k++) {
    result.push(` ${orig[k]}`)
  }

  // Removed lines
  for (const line of origChanged) {
    result.push(`-${line}`)
  }

  // Added lines
  for (const line of currChanged) {
    result.push(`+${line}`)
  }

  // Add context after
  for (let k = origEnd; k < Math.min(orig.length, origEnd + context); k++) {
    result.push(` ${orig[k]}`)
  }

  return result
}

export function createSessionTracker(): SessionTracker {
  const snapshots = new Map<string, FileSnapshot>()

  return {
    recordRead(filepath: string, content: string) {
      if (!snapshots.has(filepath)) {
        snapshots.set(filepath, { originalContent: content, currentContent: content })
      }
    },

    recordWrite(filepath: string, content: string) {
      const existing = snapshots.get(filepath)
      if (existing) {
        existing.currentContent = content
      } else {
        // File written without being read first - treat empty as original
        snapshots.set(filepath, { originalContent: "", currentContent: content })
      }
    },

    getDiff(filepath: string) {
      const snap = snapshots.get(filepath)
      if (!snap) return undefined
      if (snap.originalContent === snap.currentContent) return undefined
      return computeUnifiedDiff(snap.originalContent, snap.currentContent)
    },

    getAllDiffs() {
      const result = new Map<string, string>()
      for (const [filepath, snap] of snapshots) {
        if (snap.originalContent !== snap.currentContent) {
          const diff = computeUnifiedDiff(snap.originalContent, snap.currentContent)
          if (diff) result.set(filepath, diff)
        }
      }
      return result
    },

    hasChanges() {
      for (const snap of snapshots.values()) {
        if (snap.originalContent !== snap.currentContent) return true
      }
      return false
    },

    clear() {
      snapshots.clear()
    },
  }
}