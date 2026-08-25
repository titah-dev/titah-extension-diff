import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getGitDiff, isGitRepo } from "../src/git-diff.ts"

describe("git-diff", () => {
  // Use titah main project as it's a known git repo
  const gitCwd = "/Users/akil/Documents/Corporate/Titah/titah"

  it("isGitRepo returns true for git repo", async () => {
    const result = await isGitRepo(gitCwd, AbortSignal.none)
    assert.strictEqual(result, true)
  })

  it("getGitDiff returns array of strings", async () => {
    const lines = await getGitDiff({
      cwd: gitCwd,
      signal: AbortSignal.none,
      limit: 50,
    })
    assert(Array.isArray(lines))
    // May be empty if clean repo
  })
})