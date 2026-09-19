import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseDiff } from "../src/diff-parse.ts"
import { selectionRange, selectedCount, toReferences } from "../src/selection.ts"

/**
 * Referensi yang salah diam-diam adalah kegagalan termahal di extension ini.
 *
 * Panel yang kosong terlihat rusak dan orang melaporkannya. Referensi yang
 * meleset dua baris terlihat BENAR, dan yang terjadi adalah agent menulis
 * komentar di atas fungsi yang salah.
 */

const DIFF = parseDiff([
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -10,3 +10,5 @@",
  " const satu = 1",
  "-const dua = 2",
  "+const dua = 22",
  "+const tiga = 3",
  "+const empat = 4",
  " const lima = 5",
  "diff --git a/src/b.ts b/src/b.ts",
  "--- a/src/b.ts",
  "+++ b/src/b.ts",
  "@@ -40,2 +42,1 @@",
  " konteks",
  "-dihapus",
])

/** Indeks baris yang teksnya cocok — supaya test tidak ikut menghitung offset. */
function at(text: string): number {
  const index = DIFF.findIndex((row) => row.text === text)
  assert.notEqual(index, -1, `baris "${text}" tidak ada di fixture`)
  return index
}

describe("selection", () => {
  it("jangkar boleh di BAWAH kepala — seleksi ke atas sama sahnya", () => {
    assert.deepEqual(selectionRange({ anchor: 7, head: 3 }), { from: 3, to: 7 })
    assert.deepEqual(selectionRange({ anchor: 3, head: 7 }), { from: 3, to: 7 })
    assert.deepEqual(selectionRange({ anchor: 4, head: 4 }), { from: 4, to: 4 })
  })

  it("satu berkas: rentangnya diambil dari nomor sisi BARU", () => {
    assert.equal(
      toReferences(DIFF, at("const dua = 22"), at("const empat = 4")),
      "@src/a.ts:11-13 ",
    )
  })

  it("baris konteks ikut melebarkan rentang, karena user memang mem-block-nya", () => {
    assert.equal(
      toReferences(DIFF, at("const satu = 1"), at("const tiga = 3")),
      "@src/a.ts:10-12 ",
    )
  })

  it("satu baris memancarkan satu angka, bukan rentang yang kedua ujungnya sama", () => {
    const only = at("const tiga = 3")
    assert.equal(toReferences(DIFF, only, only), "@src/a.ts:12 ")
  })

  it("seleksi lintas berkas memancarkan satu referensi per berkas", () => {
    assert.equal(
      toReferences(DIFF, at("const satu = 1"), at("dihapus")),
      "@src/a.ts:10-14 @src/b.ts:42 ",
    )
  })

  it("seleksi yang SELURUHNYA hapusan tetap punya nomor — dan tidak pernah telanjang", () => {
    /*
     * Baris hapusan tidak ada di sisi baru, jadi tidak punya nomor untuk
     * dirujuk. Yang dipancarkan adalah baris terakhir yang MASIH ADA sebelumnya.
     *
     * `@path` telanjang TIDAK boleh keluar dari sini. Di awal prompt, Titah
     * membaca `@kata ` sebagai delegasi ke agent lain, jadi `@Makefile tambahkan
     * komentar` gagal dengan "Unknown agent". Nomor baris sesudah `:` yang
     * membuat pola itu tidak pernah cocok.
     */
    const only = at("dihapus")
    const hasil = toReferences(DIFF, only, only)

    assert.equal(hasil, "@src/b.ts:42 ")
    assert.doesNotMatch(hasil, /@src\/b\.ts /, "path telanjang terbaca sebagai delegasi agent")
  })

  it("hapusan yang langsung menempel di header hunk memakai angka header itu", () => {
    // Tidak ada baris yang masih ada sebelumnya untuk dijadikan jangkar; yang
    // tersisa hanyalah angka di `@@`. Tanpa jatuhan ini, referensinya jadi NaN.
    const rows = parseDiff([
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -5,1 +7,0 @@",
      "-hilang",
    ])
    const only = rows.findIndex((row) => row.text === "hilang")
    assert.equal(toReferences(rows, only, only), "@x.ts:7 ")
  })

  it("baris header dan hunk tidak menyumbang nomor apa pun", () => {
    // Memilih judul berkas bukan memilih baris. Menghitungnya sebagai baris
    // membuat rentangnya melar ke kode yang tidak dilihat user.
    assert.equal(toReferences(DIFF, DIFF.findIndex((r) => r.kind === "file"), 0), "")
    const hunk = DIFF.findIndex((row) => row.kind === "hunk")
    assert.equal(toReferences(DIFF, hunk, hunk), "")
  })

  it("rentang di luar batas dipotong, bukan melempar", () => {
    // Isi diff berubah di bawah kaki seleksi setiap kali panel refresh. Indeks
    // basi harus jadi hasil yang lebih sempit, bukan panel yang mati.
    assert.equal(toReferences(DIFF, -50, 50), "@src/a.ts:10-14 @src/b.ts:42 ")
    assert.equal(toReferences([], 0, 5), "")
  })

  it("selectedCount menghitung baris tergambar, termasuk header", () => {
    // Yang dihitung adalah apa yang TERLIHAT ditandai. Menghitung hanya baris
    // berkode membuat hint mengatakan "3 lines" saat lima baris menyala.
    assert.equal(selectedCount({ anchor: 3, head: 7 }), 5)
    assert.equal(selectedCount({ anchor: 4, head: 4 }), 1)
  })
})
