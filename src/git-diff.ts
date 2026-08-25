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
 * Mengambil unified diff dari git.
 * Menggabungkan `git diff HEAD` (unstaged) dan `git diff --cached` (staged).
 */
export async function getGitDiff(options: DiffOptions): Promise<string[]> {
  const { cwd, signal, contextLines = 3, showWhitespace = false, limit = 200 } = options

  const diffArgs = [
    "diff",
    `-U${contextLines}`,
    ...(showWhitespace ? [] : ["--ignore-space-change"]),
  ]

  const [unstaged, staged] = await Promise.all([
    git([...diffArgs, "HEAD"], { cwd, signal, maxBuffer: 1024 * 1024 }),
    git([...diffArgs, "--cached"], { cwd, signal, maxBuffer: 1024 * 1024 }),
  ])

  const parts: string[] = []

  if (unstaged.ok && unstaged.stdout.trim()) {
    parts.push(unstaged.stdout.trim())
  }
  if (staged.ok && staged.stdout.trim()) {
    if (parts.length > 0) parts.push("") // separator
    parts.push(staged.stdout.trim())
  }

  if (parts.length === 0) return []

  const combined = parts.join("\n")
  const lines = combined.split("\n")

  // Batasi jumlah baris yang dikembalikan
  return lines.slice(0, limit)
}

/**
 * Cek apakah direktori adalah repo git.
 */
export async function isGitRepo(cwd: string, signal: AbortSignal): Promise<boolean> {
  const result = await git(["rev-parse", "--git-dir"], { cwd, signal })
  return result.ok
}