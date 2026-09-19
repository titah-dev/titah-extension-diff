import type { DiffRow } from "./diff-parse.ts"

/**
 * Seleksi baris, dan penerjemahannya jadi referensi untuk prompt.
 *
 * Yang dikirim ke prompt adalah REFERENSI, bukan potongan diff: `@src/a.ts:11-13`.
 * Agent membaca berkasnya sendiri dengan tool yang sudah ia punya, jadi yang
 * perlu dibawa hanyalah alamatnya — dan alamat tidak ikut membesar saat yang
 * di-block seratus baris.
 */

export interface Selection {
  /** Tempat `v` ditekan. */
  anchor: number
  /** Tempat kursor sekarang. Boleh di ATAS jangkar. */
  head: number
}

export interface Range {
  from: number
  to: number
}

/** Menormalkan arah: seleksi ke atas sama sahnya dengan seleksi ke bawah. */
export function selectionRange(selection: Selection): Range {
  const { anchor, head } = selection
  return anchor <= head ? { from: anchor, to: head } : { from: head, to: anchor }
}

/** Berapa baris yang TERLIHAT ditandai — angka yang dipakai baris hint. */
export function selectedCount(selection: Selection): number {
  const { from, to } = selectionRange(selection)
  return to - from + 1
}

/**
 * Menerjemahkan rentang baris tergambar jadi referensi yang bisa ditempel.
 *
 * Bentuknya `@<path>:<awal>-<akhir> `, satu per berkas, dipisah spasi, dan
 * selalu diakhiri spasi supaya user langsung mengetik permintaannya.
 *
 * # Kenapa rentangnya TIDAK PERNAH boleh hilang
 *
 * Titah membaca `@kata ` di awal prompt sebagai delegasi ke agent lain
 * (`parseMention`, `core/delegate/index.ts`). `@Makefile tambahkan komentar`
 * akan gagal dengan "Unknown agent \"Makefile\"" alih-alih membaca berkas.
 * Nomor baris sesudah `:` yang membuat pola itu tidak pernah cocok — jadi
 * sebuah berkas tanpa satu pun nomor yang bisa dihitung DILEWATI, bukan
 * dipancarkan telanjang.
 *
 * @param rows seluruh baris tergambar, bukan hanya yang terpilih
 */
export function toReferences(rows: DiffRow[], from: number, to: number): string {
  if (rows.length === 0) return ""

  /*
   * Dipotong ke batas, bukan ditolak.
   *
   * Isi diff berubah di bawah kaki seleksi setiap kali panel refresh, dan
   * indeks basi harus menghasilkan referensi yang lebih sempit — bukan panel
   * yang mati di tengah giliran agent.
   */
  const first = Math.max(0, Math.min(from, to))
  const last = Math.min(rows.length - 1, Math.max(from, to))
  if (first > last) return ""

  // Map menjaga urutan sisip, jadi berkasnya keluar sesuai urutan di layar.
  const spans = new Map<string, Range>()

  for (let index = first; index <= last; index++) {
    const row = rows[index]
    if (row === undefined) continue
    // Judul berkas dan header hunk bukan baris kode. Menghitungnya membuat
    // rentang melar ke kode yang tidak dilihat user.
    if (row.kind === "file" || row.kind === "hunk") continue

    const line = row.newLine ?? anchorForDeletion(rows, index)
    if (line === undefined) continue

    const span = spans.get(row.path)
    if (span === undefined) spans.set(row.path, { from: line, to: line })
    else {
      span.from = Math.min(span.from, line)
      span.to = Math.max(span.to, line)
    }
  }

  let out = ""
  for (const [path, span] of spans) {
    out += span.from === span.to ? `@${path}:${span.from} ` : `@${path}:${span.from}-${span.to} `
  }
  return out
}

/**
 * Nomor sisi-baru untuk sebuah baris HAPUSAN.
 *
 * Baris yang dihapus tidak ada lagi di berkas, jadi ia tidak punya nomor
 * sendiri. Yang dipakai adalah baris terakhir yang MASIH ADA sebelumnya —
 * bukan baris sesudahnya, yang belum tentu ada kalau penghapusan itu menyentuh
 * akhir berkas.
 *
 * Pemindaian selalu berhenti: header hunk membawa nomor sisi-barunya sendiri,
 * dan setiap baris isi selalu punya satu di atasnya.
 */
function anchorForDeletion(rows: DiffRow[], index: number): number | undefined {
  for (let at = index - 1; at >= 0; at--) {
    const row = rows[at]
    if (row === undefined) continue
    if (row.kind === "file") return undefined
    if (row.newLine !== undefined) return row.newLine
  }
  return undefined
}
