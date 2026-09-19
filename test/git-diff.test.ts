import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { getGitDiff, isGitRepo } from "../src/git-diff.ts"
import { parseDiff } from "../src/diff-parse.ts"

/**
 * Repo sungguhan yang dibuat test ini sendiri.
 *
 * Yang lama menunjuk ke `/Users/akil/…/titah` — path absolut satu mesin, yang
 * berarti test ini gagal di mesin lain dan, lebih buruk, LULUS di mesin ini
 * tanpa menguji apa pun setiap kali repo itu kebetulan bersih: satu-satunya
 * assert-nya adalah `Array.isArray`.
 */

let repo = ""

function git(...args: string[]): void {
  execFileSync("git", args, { cwd: repo, stdio: "ignore" })
}

describe("git-diff", () => {
  before(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "titah-diff-uji-"))
    git("init", "-q")
    git("config", "user.email", "uji@contoh.test")
    git("config", "user.name", "Uji")
    git("config", "commit.gpgsign", "false")

    fs.writeFileSync(path.join(repo, "a.ts"), ["satu", "dua", "tiga"].join("\n") + "\n")
    git("add", "a.ts")
    git("commit", "-qm", "awal")
  })

  after(() => {
    if (repo !== "") fs.rmSync(repo, { recursive: true, force: true })
  })

  it("isGitRepo membedakan repo dari direktori biasa", async () => {
    assert.equal(await isGitRepo(repo, AbortSignal.timeout(5000)), true)
    assert.equal(await isGitRepo(os.tmpdir(), AbortSignal.timeout(5000)), false)
  })

  it("pohon kerja yang bersih tidak menghasilkan satu baris pun", async () => {
    assert.deepEqual(await getGitDiff({ cwd: repo, signal: AbortSignal.timeout(5000) }), [])
  })

  it("perubahan yang DI-STAGE muncul SEKALI, bukan dua kali", async () => {
    /*
     * Pin untuk bug yang sudah pernah dikirim: `git diff HEAD` sudah memuat yang
     * di-stage, dan menggabungkannya dengan `git diff --cached` membuat setiap
     * perubahan yang di-stage tergambar dua kali lengkap dengan header berkasnya.
     * Di panel diff, hunk kembar terbaca seperti konflik, bukan seperti bug.
     */
    fs.writeFileSync(path.join(repo, "a.ts"), ["satu", "DUA", "tiga"].join("\n") + "\n")
    git("add", "a.ts")

    const lines = await getGitDiff({ cwd: repo, signal: AbortSignal.timeout(5000) })
    const rows = parseDiff(lines)

    assert.equal(rows.filter((row) => row.kind === "file").length, 1, "header berkas kembar")
    assert.deepEqual(
      rows.filter((row) => row.kind === "add").map((row) => row.text),
      ["DUA"],
    )
    assert.deepEqual(
      rows.filter((row) => row.kind === "del").map((row) => row.text),
      ["dua"],
    )
  })

  it("staged dan unstaged pada berkas yang sama jadi satu diff terhadap HEAD", async () => {
    // Baris ketiga diubah TANPA di-stage, di atas perubahan yang sudah di-stage.
    fs.writeFileSync(path.join(repo, "a.ts"), ["satu", "DUA", "TIGA"].join("\n") + "\n")

    const rows = parseDiff(await getGitDiff({ cwd: repo, signal: AbortSignal.timeout(5000) }))
    assert.equal(rows.filter((row) => row.kind === "file").length, 1)
    assert.deepEqual(
      rows.filter((row) => row.kind === "add").map((row) => row.text),
      ["DUA", "TIGA"],
    )
  })

  it("limit memotong keluaran, supaya panel tidak dibanjiri satu berkas raksasa", async () => {
    const lines = await getGitDiff({ cwd: repo, signal: AbortSignal.timeout(5000), limit: 3 })
    assert.equal(lines.length, 3)
  })

  it("direktori yang bukan repo menghasilkan nol baris, bukan lemparan", async () => {
    assert.deepEqual(
      await getGitDiff({ cwd: os.tmpdir(), signal: AbortSignal.timeout(5000) }),
      [],
    )
  })
})
