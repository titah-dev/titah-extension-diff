import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseDiff } from "../src/diff-parse.ts"
import { drawRow, gutterDigits } from "../src/render-diff.ts"

const ROWS = parseDiff([
  "diff --git a/src/core/agent.ts b/src/core/agent.ts",
  "--- a/src/core/agent.ts",
  "+++ b/src/core/agent.ts",
  "@@ -210,2 +212,3 @@",
  " const turns = load()",
  "-return turns",
  "+export function summarize() {",
])

function find(kind: string) {
  const row = ROWS.find((candidate) => candidate.kind === kind)
  assert.ok(row, `tidak ada baris ${kind}`)
  return row
}

const WIDE = { width: 60, digits: 3, cursor: false, selected: false }

describe("render-diff", () => {
  it("gutter MENGALAH pada panel sempit", () => {
    /*
     * Panel bawaan Titah 20 kolom, tersisa sekitar 16 untuk teks. Gutter di situ
     * memakan hampir semuanya dan menyisakan potongan kode yang tidak terbaca —
     * jadi ia mati sendiri, lalu hidup lagi saat user melebarkan panel.
     */
    assert.equal(gutterDigits(ROWS, 16), 0)
    assert.equal(gutterDigits(ROWS, 60), 3)
  })

  it("diff tanpa satu pun nomor tidak memaksakan gutter", () => {
    assert.equal(gutterDigits(parseDiff([]), 200), 0)
  })

  it("tambahan hijau, hapusan merah, konteks tanpa warna", () => {
    assert.equal(drawRow(find("add"), WIDE).color, "green")
    assert.equal(drawRow(find("del"), WIDE).color, "red")
    assert.equal(drawRow(find("context"), WIDE).color, undefined)
  })

  it("nomor lama dan baru berdiri di kolomnya masing-masing", () => {
    // Baris tambahan tidak ada di sisi lama, jadi kolom kiri harus KOSONG —
    // mengisinya dengan nomor mana pun membuat gutter berbohong.
    assert.match(drawRow(find("context"), WIDE).text, /^ 210 212 {4}const turns/)
    assert.match(drawRow(find("add"), WIDE).text, /^ {5}213 {2}\+ export function/)
    assert.match(drawRow(find("del"), WIDE).text, /^ 211 {6}- return turns/)
  })

  it("tanpa gutter, marker +/- tetap ada — itu yang tersisa untuk membedakan", () => {
    const sempit = { width: 16, digits: 0, cursor: false, selected: false }
    assert.match(drawRow(find("add"), sempit).text, /^ {2}\+ export/)
    assert.match(drawRow(find("del"), sempit).text, /^ {2}- return/)
  })

  it("kursor menandai dirinya di kolom pertama, dan minta bold", () => {
    const drawn = drawRow(find("add"), { ...WIDE, cursor: true })
    assert.match(drawn.text, /^›/)
    assert.equal(drawn.selected, true)
  })

  it("baris terpilih memakai GLYPH, bukan bold — bold sudah milik kursor", () => {
    /*
     * `PanelLine` tidak punya background, dan `selected` dipetakan host jadi
     * bold. Memakainya untuk seleksi membuat baris kursor tidak bisa dibedakan
     * dari baris yang sekadar ikut ditandai.
     */
    const drawn = drawRow(find("add"), { ...WIDE, selected: true })
    assert.match(drawn.text, /▌/)
    assert.equal(drawn.selected, undefined)
  })

  it("judul berkas jadi garis pemisah selebar panel", () => {
    const drawn = drawRow(find("file"), WIDE)
    assert.equal(drawn.color, "cyan")
    assert.match(drawn.text, /^─ src\/core\/agent\.ts ─+$/)
    assert.equal(drawn.text.length, 60)
  })

  it("path panjang dipotong dari DEPAN, karena ekornya yang informatif", () => {
    // Yang harus selamat adalah nama berkasnya; yang boleh hilang adalah
    // direktori teratas. Kebalikannya memberi "src/core/…" di setiap baris.
    const drawn = drawRow(find("file"), { ...WIDE, width: 20 })
    assert.match(drawn.text, /^─ ….*agent\.ts ─+$/)
    assert.equal(drawn.text.length, 20)
  })

  it("header hunk menyebut ke baris berapa ia melompat", () => {
    // Gutter yang tiba-tiba loncat dari 40 ke 212 tanpa keterangan terlihat
    // seperti kerusakan, bukan seperti potongan yang memang dilewati.
    const drawn = drawRow(find("hunk"), WIDE)
    assert.match(drawn.text, /⋯ 212/)
    assert.equal(drawn.dim, true)
  })

  it("tidak ada baris yang melebihi lebarnya", () => {
    // Host memotong lagi di sisinya, tapi baris yang membungkus mendorong
    // barisnya sendiri keluar dari tinggi yang sudah direservasi.
    const panjang = parseDiff([
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,1 +1,1 @@",
      "+" + "z".repeat(400),
    ])
    for (const width of [8, 16, 40, 60]) {
      for (const row of panjang) {
        const drawn = drawRow(row, { width, digits: gutterDigits(panjang, width), cursor: false, selected: false })
        assert.ok(drawn.text.length <= width, `${row.kind} di ${width}: ${drawn.text.length}`)
      }
    }
  })
})
