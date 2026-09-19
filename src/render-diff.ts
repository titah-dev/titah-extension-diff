import type { DiffRow } from "./diff-parse.ts"
import { truncateEnd, truncateStart } from "./layout.ts"

/**
 * Menggambar satu `DiffRow` jadi satu baris bergaya.
 *
 * # Kenapa warnanya PER BARIS dan bukan per token
 *
 * `PanelLine` di host hanya membawa `text`, `dim`, `color`, dan `bold` — satu
 * gaya untuk seluruh baris, tanpa background dan tanpa span. Syntax highlighting
 * menuntut span, dan span menuntut perubahan kontrak lagi. Warna per baris
 * sudah memberi yang paling menentukan: hijau tambahan, merah hapusan.
 *
 * Konsekuensi lain dari batas yang sama: seleksi ditandai dengan GLYPH `▌` di
 * gutter, bukan dengan blok warna. Tidak ada background untuk dipakai.
 */

export interface StyledRow {
  text: string
  color?: string
  dim?: boolean
  selected?: boolean
}

/** Kolom minimum yang harus tersisa untuk kode sebelum gutter layak dipasang. */
const MIN_CODE_COLUMNS = 22

/** Kolom tetap di luar nomor: kursor, dua pemisah, penanda seleksi, marker, spasi. */
const FIXED_COLUMNS = 6

/**
 * Berapa digit yang dipakai TIAP kolom nomor — `0` berarti gutter dimatikan.
 *
 * Panel bawaan Titah hanya 20 kolom (`PANEL_WIDTH`), menyisakan sekitar enam
 * belas untuk teks. Gutter di situ akan memakan hampir seluruhnya dan
 * menyisakan potongan kode yang tidak bisa dibaca siapa pun — jadi ia MENGALAH
 * pada panel sempit, dan muncul sendiri begitu user melebarkannya dengan `+`.
 */
export function gutterDigits(rows: DiffRow[], width: number): number {
  let highest = 0
  for (const row of rows) {
    if (row.oldLine !== undefined && row.oldLine > highest) highest = row.oldLine
    if (row.newLine !== undefined && row.newLine > highest) highest = row.newLine
  }
  if (highest === 0) return 0

  const digits = String(highest).length
  return width - (digits * 2 + FIXED_COLUMNS) >= MIN_CODE_COLUMNS ? digits : 0
}

export interface DrawOptions {
  /** Lebar teks yang tersedia, sudah bersih dari bingkai. */
  width: number
  /** Digit per kolom nomor; `0` mematikan gutter. Lihat `gutterDigits`. */
  digits: number
  cursor: boolean
  selected: boolean
}

export function drawRow(row: DiffRow, options: DrawOptions): StyledRow {
  const { width, digits, cursor, selected } = options

  /*
   * Judul berkas memakai seluruh lebarnya sebagai garis pemisah, dan BUKAN baris
   * tersendiri di bawahnya: baris pemisah terpisah akan menggeser pemetaan
   * indeks baris tergambar ke indeks data, yang persis bug yang baru saja
   * diperbaiki di `layout.ts`.
   */
  if (row.kind === "file") {
    const head = `${cursor ? "›" : "─"} ${truncateStart(row.path, Math.max(1, width - 4))} `
    return { text: head + "─".repeat(Math.max(0, width - head.length)), color: "cyan" }
  }

  const lead = cursor ? "›" : " "

  if (row.kind === "hunk") {
    // Menandai lompatan, dan menyebut ke baris berapa ia melompat — tanpa itu,
    // gutter yang tiba-tiba loncat dari 40 ke 212 terlihat seperti kerusakan.
    const text = `${lead}${gutter("", "", digits)}${selected ? "▌" : " "}⋯ ${row.newLine ?? ""}`
    return { text: truncateEnd(text, width), dim: true }
  }

  const marker = row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "
  const numbers = gutter(
    row.oldLine === undefined ? "" : String(row.oldLine),
    row.newLine === undefined ? "" : String(row.newLine),
    digits,
  )
  const prefix = `${lead}${numbers}${selected ? "▌" : " "}${marker} `

  return {
    // Kode dipotong dari BELAKANG: awal barisnya yang paling berarti.
    text: prefix + truncateEnd(row.text, Math.max(0, width - prefix.length)),
    ...(row.kind === "add" ? { color: "green" } : {}),
    ...(row.kind === "del" ? { color: "red" } : {}),
    /*
     * `selected` HANYA berarti kursor, tidak pernah berarti "ikut seleksi".
     * Host memetakannya jadi bold, dan memakainya untuk dua hal sekaligus
     * membuat baris kursor tidak bisa dibedakan dari baris yang ditandai.
     */
    ...(cursor ? { selected: true } : {}),
  }
}

/** Dua kolom nomor rata kanan, atau string kosong saat gutter dimatikan. */
function gutter(oldLine: string, newLine: string, digits: number): string {
  if (digits === 0) return ""
  return `${oldLine.padStart(digits)} ${newLine.padStart(digits)} `
}
