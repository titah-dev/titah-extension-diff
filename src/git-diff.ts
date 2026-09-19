import { execFile } from "node:child_process"

/**
 * Pemanggilan git diff, dipisah dari panel supaya bisa diuji tanpa render.
 *
 * Setiap perintah memakai `--no-optional-locks` dan tidak pernah menulis.
 */

export interface RunResult {
  stdout: string
  ok: boolean
}

export interface RunOptions {
  cwd: string
  signal: AbortSignal
  maxBuffer?: number
}

export function git(args: string[], options: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["--no-optional-locks", ...args],
      {
        cwd: options.cwd,
        signal: options.signal,
        maxBuffer: options.maxBuffer ?? 1024 * 1024,
        env: { ...process.env, LC_ALL: "C", GIT_OPTIONAL_LOCKS: "0" },
      },
      (error, stdout) => {
        if (error) return resolve({ stdout: "", ok: false })
        resolve({ stdout, ok: true })
      },
    )
  })
}

export interface DiffOptions {
  cwd: string
  signal: AbortSignal
  contextLines?: number
  showWhitespace?: boolean
  limit?: number
}

/**
 * Mengambil unified diff dari git: SEMUA yang berbeda dari HEAD.
 *
 * Satu perintah, bukan dua. Yang lama menggabungkan `git diff HEAD` dengan
 * `git diff --cached` — padahal `HEAD` SUDAH memuat yang di-stage, jadi setiap
 * perubahan yang di-stage muncul dua kali, lengkap dengan header berkasnya.
 * Di panel diff, hunk kembar terbaca seperti konflik, bukan seperti bug.
 *
 * Berkas yang belum dilacak git tidak ikut, sama seperti sebelumnya:
 * `git diff` memang tidak melihatnya, dan menampilkan seluruh isi berkas baru
 * sebagai satu hunk raksasa akan mengusir seluruh perubahan lain keluar dari
 * batas `limit`.
 */
export async function getGitDiff(options: DiffOptions): Promise<string[]> {
  const { cwd, signal, contextLines = 3, showWhitespace = false, limit = 200 } = options

  const result = await git(
    [
      "diff",
      `-U${contextLines}`,
      ...(showWhitespace ? [] : ["--ignore-space-change"]),
      "HEAD",
    ],
    { cwd, signal, maxBuffer: 1024 * 1024 },
  )

  if (!result.ok) return []

  const text = result.stdout.trim()
  if (text === "") return []

  return text.split("\n").slice(0, limit)
}

/**
 * Cek apakah direktori adalah repo git.
 */
export async function isGitRepo(cwd: string, signal: AbortSignal): Promise<boolean> {
  const result = await git(["rev-parse", "--git-dir"], { cwd, signal })
  return result.ok
}