import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createSessionTracker } from "../src/session-tracker.ts"

describe("session-tracker", () => {
  it("records read and write, computes diff", () => {
    const tracker = createSessionTracker()

    tracker.recordRead("file.txt", "line 1\nline 2\nline 3")
    tracker.recordWrite("file.txt", "line 1\nline 2 modified\nline 3\nline 4")

    const diff = tracker.getDiff("file.txt")
    assert(diff !== undefined)
    assert(diff!.includes("-line 2"))
    assert(diff!.includes("+line 2 modified"))
    assert(diff!.includes("+line 4"))
  })

  it("returns undefined for unchanged file", () => {
    const tracker = createSessionTracker()
    tracker.recordRead("file.txt", "same content")
    tracker.recordWrite("file.txt", "same content")

    const diff = tracker.getDiff("file.txt")
    assert.strictEqual(diff, undefined)
  })

  it("getAllDiffs returns map of changed files", () => {
    const tracker = createSessionTracker()
    tracker.recordRead("a.txt", "original")
    tracker.recordRead("b.txt", "original")
    tracker.recordWrite("a.txt", "modified")

    const diffs = tracker.getAllDiffs()
    assert.strictEqual(diffs.size, 1)
    assert(diffs.has("a.txt"))
    assert(!diffs.has("b.txt"))
  })

  it("hasChanges detects modifications", () => {
    const tracker = createSessionTracker()
    assert.strictEqual(tracker.hasChanges(), false)

    tracker.recordRead("file.txt", "original")
    assert.strictEqual(tracker.hasChanges(), false)

    tracker.recordWrite("file.txt", "modified")
    assert.strictEqual(tracker.hasChanges(), true)
  })

  it("clear resets tracker", () => {
    const tracker = createSessionTracker()
    tracker.recordRead("file.txt", "original")
    tracker.recordWrite("file.txt", "modified")
    tracker.clear()

    assert.strictEqual(tracker.hasChanges(), false)
    assert.strictEqual(tracker.getDiff("file.txt"), undefined)
  })

  it("write without read treats empty as original", () => {
    const tracker = createSessionTracker()
    tracker.recordWrite("new.txt", "new content")

    const diff = tracker.getDiff("new.txt")
    assert(diff !== undefined)
    assert(diff!.includes("+new content"))
  })
})