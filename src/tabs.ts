/**
 * Tab state machine dan layout, mirip sections.ts di git extension.
 */

export type TabId = "git" | "session"

export const TABS: { id: TabId; title: string }[] = [
  { id: "git", title: "Git Diff" },
  { id: "session", title: "Session Changes" },
]

export const HINT = "tab switch · ↑↓ scroll · r refresh"

export interface TabLayoutInput {
  rows: number
  activeTab: TabId
  cursor: number
  contentLines: number
}

export interface TabLayout {
  budget: number
  offset: number
  visible: number
}

/**
 * Hitung budget dan offset untuk tab aktif.
 */
export function tabLayout(input: TabLayoutInput): TabLayout {
  // 1 baris untuk tab bar, 1 baris untuk hint
  const budget = Math.max(0, input.rows - 2)
  const total = input.contentLines

  if (budget === 0 || total === 0) return { budget, offset: 0, visible: 0 }

  const cursor = clamp(input.cursor, 0, total - 1)
  const offset = Math.max(0, Math.min(cursor - budget + 1, total - budget))
  return { budget, offset: Math.max(0, offset), visible: Math.min(budget, total - Math.max(0, offset)) }
}

export function nextTab(current: TabId): TabId {
  const index = TABS.findIndex((t) => t.id === current)
  return TABS[(index + 1) % TABS.length]?.id ?? "git"
}

export function prevTab(current: TabId): TabId {
  const index = TABS.findIndex((t) => t.id === current)
  return TABS[(index - 1 + TABS.length) % TABS.length]?.id ?? "git"
}

export function moveCursor(cursor: number, delta: number, total: number): number {
  if (total === 0) return 0
  return clamp(cursor + delta, 0, total - 1)
}

export type TabRow =
  | { kind: "tab"; tab: TabId; active: boolean; title: string }
  | { kind: "content"; text: string; cursor: boolean }
  | { kind: "empty"; text: string }
  | { kind: "hint"; text: string }

export interface TabPlanInput extends TabLayoutInput {
  content: string[]
  emptyLabel: string
}

/**
 * Bangun baris yang akan digambar untuk tab aktif.
 */
export function planTab(input: TabPlanInput): TabRow[] {
  const { budget, offset, visible } = tabLayout(input)
  const cursor = clamp(input.cursor, 0, Math.max(0, input.contentLines - 1))
  const rows: TabRow[] = []

  // Tab bar
  for (const tab of TABS) {
    rows.push({
      kind: "tab",
      tab: tab.id,
      active: tab.id === input.activeTab,
      title: tab.title,
    })
  }

  // Content area
  if (input.contentLines === 0) {
    if (budget > 0) {
      rows.push({ kind: "empty", text: input.emptyLabel })
    }
  } else {
    for (let index = 0; index < visible; index++) {
      const at = offset + index
      rows.push({
        kind: "content",
        text: input.content[at] ?? "",
        cursor: at === cursor,
      })
    }
  }

  rows.push({ kind: "hint", text: HINT })
  return rows
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high))
}

/**
 * Memendekkan teks dari BELAKANG (untuk diff lines), berbeda dari path yang dipotong dari depan.
 */
export function truncateEnd(value: string, width: number): string {
  if (width <= 1) return value.slice(0, Math.max(0, width))
  if (value.length <= width) return value
  return value.slice(0, width - 1) + "…"
}