import type { ExtensionFactory, View, ViewRow } from "titah-code/extension"
import { getGitDiff, isGitRepo } from "./git-diff.ts"
import { parseDiff, type DiffRow } from "./diff-parse.ts"
import { drawRow, gutterDigits } from "./render-diff.ts"
import { HINT, moveCursor, planView, visualHint, type PlanRow } from "./layout.ts"
import {
  selectedCount,
  selectionRange,
  toReferences,
  type Selection,
} from "./selection.ts"

/**
 * Panel diff untuk Titah — tampilan bergaya editor, dengan seleksi baris.
 *
 * Ditulis HANYA dengan `titah-code/extension`. Tidak ada akses ke internal Titah.
 *
 * Yang membedakannya dari panel diff biasa: baris bisa di-block (`v`, lalu `↑↓`)
 * dan dikirim ke prompt utama (`y`) sebagai referensi `@path:awal-akhir`. Agent
 * membaca berkasnya sendiri dari situ, jadi yang berpindah cuma alamatnya —
 * seratus baris yang di-block tidak jadi seratus baris di prompt.
 */

interface Options {
  gitDiffLimit?: number
  contextLines?: number
  showWhitespace?: boolean
}

const factory: ExtensionFactory = ({ cwd, options }) => {
  const settings = options as Options
  const gitDiffLimit = Math.max(1, settings.gitDiffLimit ?? 200)
  const contextLines = Math.max(0, settings.contextLines ?? 3)
  const showWhitespace = settings.showWhitespace ?? false

  let cursor = 0
  let selection: Selection | undefined
  let rows: DiffRow[] = []
  let drawn: PlanRow[] = []
  let emptyLabel = "clean"

  /*
   * Sidik jari isi diff yang sedang ditandai.
   *
   * Seleksi adalah sepasang INDEKS, dan indeks hanya berarti selama daftarnya
   * tidak berubah. Panel ini di-refresh host pada empat momen — salah satunya
   * akhir giliran agent, yang justru saat isi diff paling mungkin berubah.
   * Menyimpan seleksi melewati perubahan itu berarti `y` mengirim referensi ke
   * baris yang sudah bukan baris itu lagi, tanpa satu pun tanda di layar.
   *
   * Yang TIDAK boleh dilakukan adalah membuang seleksi di setiap render:
   * menekan `↓` saat visual mode menyala juga meminta render, jadi seleksinya
   * akan mati satu tombol sesudah dibuat.
   */
  let fingerprint = ""

  return {
    title: "Diff",
    side: "right",
    key: "<leader>d",

    async render({ signal, width, rows: height }): Promise<View> {
      let lines: string[] = []
      if (await isGitRepo(cwd, signal)) {
        lines = await getGitDiff({ cwd, signal, contextLines, showWhitespace, limit: gitDiffLimit })
        emptyLabel = "clean"
      } else {
        emptyLabel = "not a git repo"
      }

      const next = lines.join("\n")
      if (next !== fingerprint) {
        fingerprint = next
        selection = undefined
      }

      rows = parseDiff(lines)
      cursor = moveCursor(cursor, 0, rows.length)

      const marked = selection === undefined ? undefined : selectionRange(selection)
      drawn = planView({
        rows: height,
        cursor,
        contentLines: rows.length,
        ...(marked === undefined ? {} : { selection: marked }),
        emptyLabel,
        hint: selection === undefined ? HINT : visualHint(selectedCount(selection)),
      })

      const digits = gutterDigits(rows, width)
      return { kind: "rows", rows: drawn.map((row) => draw(row, rows, width, digits)) }
    },

    onKey({ key }) {
      if (key === "up" || key === "down") {
        cursor = moveCursor(cursor, key === "up" ? -1 : 1, rows.length)
        // Kepala seleksi mengikuti kursor; jangkarnya tinggal di tempat.
        if (selection !== undefined) selection = { anchor: selection.anchor, head: cursor }
        return { refresh: true }
      }

      if (key === "v") {
        // Satu tombol untuk menyalakan DAN membatalkan, karena `escape` tidak
        // pernah sampai ke sini — host memakainya untuk melepas fokus panel.
        selection = selection === undefined ? { anchor: cursor, head: cursor } : undefined
        return { refresh: true }
      }

      if (key === "y") {
        /*
         * Tanpa seleksi, `y` mengirim baris di bawah kursor.
         *
         * Mem-block satu baris untuk mengirim satu baris adalah tiga tombol
         * untuk pekerjaan satu tombol, dan satu baris adalah kasus yang paling
         * sering: "apa ini", "kenapa baris ini berubah".
         */
        const { from, to } = selection === undefined
          ? { from: cursor, to: cursor }
          : selectionRange(selection)

        const text = toReferences(rows, from, to)
        selection = undefined
        // Judul berkas dan header hunk tidak punya nomor untuk dirujuk. Diam
        // lebih baik daripada menyisipkan sesuatu yang harus user hapus lagi.
        if (text === "") return { refresh: true }
        return { prompt: { text }, refresh: true }
      }

      if (key === "r") return { refresh: true }
      return undefined
    },

    onClick({ row }) {
      const target = drawn[row]
      if (target === undefined || target.kind !== "content") return undefined

      // Inilah yang dulu tidak bisa dilakukan: `row` adalah indeks baris
      // TERGAMBAR, dan `index` yang dibawa rencana barislah yang menerjemahkannya
      // ke indeks data.
      cursor = target.index
      if (selection !== undefined) selection = { anchor: selection.anchor, head: cursor }
      return { refresh: true }
    },
  }
}

/** Menerjemahkan satu baris rencana jadi satu `ViewRow`. */
function draw(plan: PlanRow, rows: DiffRow[], width: number, digits: number): ViewRow {
  switch (plan.kind) {
    case "content": {
      const row = rows[plan.index]
      if (row === undefined) return { text: "" }
      return drawRow(row, { width, digits, cursor: plan.cursor, selected: plan.selected })
    }
    case "empty":
      return { text: `  ${plan.text}`, dim: true }
    case "hint":
      return { text: plan.text, dim: true }
  }
}

export default factory
