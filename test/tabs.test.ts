import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { tabLayout, nextTab, prevTab, moveCursor, planTab, truncateEnd } from "../src/tabs.ts"

describe("tabs", () => {
  describe("tabLayout", () => {
    it("calculates budget with rows minus tab bar and hint", () => {
      const layout = tabLayout({ rows: 10, activeTab: "git", cursor: 0, contentLines: 20 })
      assert.strictEqual(layout.budget, 8) // 10 - 2 = 8
    })

    it("returns zero visible when no content", () => {
      const layout = tabLayout({ rows: 10, activeTab: "git", cursor: 0, contentLines: 0 })
      assert.strictEqual(layout.visible, 0)
    })

    it("clamps cursor to valid range", () => {
      const layout = tabLayout({ rows: 3, activeTab: "git", cursor: 999, contentLines: 5 })
      assert.strictEqual(layout.visible, 1) // 3 - 2 = 1
    })
  })

  describe("nextTab / prevTab", () => {
    it("cycles git -> session", () => {
      assert.strictEqual(nextTab("git"), "session")
    })

    it("cycles session -> git", () => {
      assert.strictEqual(nextTab("session"), "git")
    })

    it("prevTab cycles session -> git", () => {
      assert.strictEqual(prevTab("session"), "git")
    })

    it("prevTab cycles git -> session", () => {
      assert.strictEqual(prevTab("git"), "session")
    })
  })

  describe("moveCursor", () => {
    it("clamps at zero", () => {
      assert.strictEqual(moveCursor(0, -1, 10), 0)
    })

    it("clamps at max", () => {
      assert.strictEqual(moveCursor(9, 1, 10), 9)
    })

    it("moves within range", () => {
      assert.strictEqual(moveCursor(5, -3, 10), 2)
    })
  })

  describe("planTab", () => {
    it("generates tab bar rows", () => {
      const rows = planTab({
        rows: 5,
        activeTab: "git",
        cursor: 0,
        contentLines: 0,
        content: [],
        emptyLabel: "clean",
      })
      assert.strictEqual(rows.length, 4) // 2 tabs + 1 empty + 1 hint
      assert.strictEqual(rows[0]?.kind, "tab")
    })

    it("shows content when available", () => {
      const rows = planTab({
        rows: 5,
        activeTab: "git",
        cursor: 0,
        contentLines: 10,
        content: ["line 1", "line 2", "line 3", "line 4"],
        emptyLabel: "clean",
      })
      // 2 tabs + 3 visible content + 1 hint
      assert.strictEqual(rows.length, 6)
    })
  })

  describe("truncateEnd", () => {
    it("truncates long text from end", () => {
      assert.strictEqual(truncateEnd("hello world", 8), "hello w…")
    })

    it("returns original if short enough", () => {
      assert.strictEqual(truncateEnd("hi", 5), "hi")
    })
  })
})