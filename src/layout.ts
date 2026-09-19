import type { Range } from "./selection.ts"

/**
 * Jendela, kursor, dan rencana baris. Murni, tanpa I/O.
 *
 * Menggantikan `tabs.ts`: tab sudah tidak ada lagi, jadi yang tersisa dari
 * berkas lama hanyalah aritmetikanya — dan aritmetika itu salah satu baris.
 */

export const HINT = "↑↓ move · v select · y send · r refresh"

/**
 * Hint saat visual mode menyala.
 *
 * Pembatalnya `v`, BUKAN `esc`. Host mencegat `escape` untuk melepas fokus
 * panel (`app.tsx`, cabang `press.key === "escape"`) dan mengembalikannya
 * sebelum `onKey` sempat dipanggil — jadi tombol itu tidak pernah sampai ke
 * sini, dan mengiklankannya berarti mengiklankan tombol yang mati.
 */
export function visualHint(count: number): string {
  return `VISUAL ${count} line${count === 1 ? "" : "s"} · y send · v cancel`
}

export interface LayoutInput {
  /** Baris isi yang diberikan host, sesudah bingkai dan judul. */
  rows: number
  cursor: number
  contentLines: number
}

export interface Layout {
  budget: number
  offset: number
  visible: number
}

/**
 * Berapa baris yang boleh dipakai isi, dan bagian mana yang terlihat.
 *
 * SATU baris direservasi, untuk hint.
 *
 * Yang lama memesan dua — satu untuk hint, satu untuk "tab bar" — padahal tab
 * bar mendorong satu baris PER TAB. Dengan dua tab, panel selalu menggambar
 * satu baris lebih banyak daripada yang direservasi host, dan barisnya terpotong
 * di tempat yang tidak dijelaskan apa pun.
 */
export function layout(input: LayoutInput): Layout {
  const budget = Math.max(0, input.rows - 1)
  const total = input.contentLines

  if (budget === 0 || total === 0) return { budget, offset: 0, visible: 0 }

  const cursor = clamp(input.cursor, 0, total - 1)
  const offset = Math.max(0, Math.min(cursor - budget + 1, total - budget))
  return { budget, offset, visible: Math.min(budget, total - offset) }
}

export function moveCursor(cursor: number, delta: number, total: number): number {
  if (total === 0) return 0
  return clamp(cursor + delta, 0, total - 1)
}

export type PlanRow =
  /**
   * `index` adalah indeks di dalam DATA, bukan di layar.
   *
   * Inilah yang dulu hilang. `onClick` menerima indeks baris TERGAMBAR, dan
   * tanpa angka ini panel tidak bisa tahu baris data mana yang diklik — panel
   * lama menuliskan kekurangan itu sebagai komentar lalu mengembalikan
   * `refresh` saja, sehingga klik pada isi tidak melakukan apa-apa.
   */
  | { kind: "content"; index: number; cursor: boolean; selected: boolean }
  | { kind: "empty"; text: string }
  | { kind: "hint"; text: string }

export interface PlanInput extends LayoutInput {
  /** Rentang indeks DATA yang sedang ditandai, kalau visual mode menyala. */
  selection?: Range
  emptyLabel: string
  hint?: string
}

/** Menyusun baris yang akan digambar, tanpa menyentuh teksnya. */
export function planView(input: PlanInput): PlanRow[] {
  const { budget, offset, visible } = layout(input)
  const cursor = clamp(input.cursor, 0, Math.max(0, input.contentLines - 1))
  const rows: PlanRow[] = []

  if (input.contentLines === 0) {
    if (budget > 0) rows.push({ kind: "empty", text: input.emptyLabel })
  } else {
    for (let step = 0; step < visible; step++) {
      const index = offset + step
      rows.push({
        kind: "content",
        index,
        cursor: index === cursor,
        selected:
          input.selection !== undefined &&
          index >= input.selection.from &&
          index <= input.selection.to,
      })
    }
  }

  rows.push({ kind: "hint", text: input.hint ?? HINT })
  return rows
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high))
}

/** Memotong dari BELAKANG — untuk baris kode, yang awalnya paling berarti. */
export function truncateEnd(value: string, width: number): string {
  if (width <= 1) return value.slice(0, Math.max(0, width))
  if (value.length <= width) return value
  return value.slice(0, width - 1) + "…"
}

/**
 * Memotong dari DEPAN — untuk path, yang EKORNYA paling berarti.
 *
 * `src/tui/…` memberi tahu lebih sedikit daripada `…/tui/app.tsx`: yang dicari
 * orang di judul berkas adalah nama berkasnya, bukan direktori teratasnya.
 */
export function truncateStart(value: string, width: number): string {
  if (width <= 1) return value.slice(0, Math.max(0, width))
  if (value.length <= width) return value
  return "…" + value.slice(value.length - (width - 1))
}
