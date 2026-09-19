import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseDiff, type DiffRow } from "../src/diff-parse.ts"

/**
 * Nomor baris adalah inti berkas ini.
 *
 * Gutter menggambarnya, dan referensi `@path:awal-akhir` dihitung darinya. Salah
 * satu angka berarti panel mengirim agent ke baris yang salah — dan referensi
 * yang salah diam-diam jauh lebih merugikan daripada panel yang kosong.
 *
 * Fixture ditulis sebagai array baris, bukan template literal: teks diff peka
 * pada spasi di kolom pertama, dan indentasi apa pun di berkas test mengubah
 * arti barisnya.
 */

const SATU_BERKAS = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 2e7b353..383270d 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -10,4 +10,5 @@",
  " const satu = 1",
  "-const dua = 2",
  "+const dua = 22",
  "+const tiga = 3",
  " const empat = 4",
]

describe("diff-parse", () => {
  it("header berkas jadi satu baris, dan noise git dibuang", () => {
    const rows = parseDiff(SATU_BERKAS)

    const files = rows.filter((row) => row.kind === "file")
    assert.equal(files.length, 1)
    assert.equal(files[0]?.path, "src/a.ts")

    // `index`, `--- a/`, `+++ b/` tidak pernah digambar: ia noise mesin, dan di
    // panel selebar dua puluh kolom ia memakan tempat baris yang berarti.
    assert.deepEqual(
      rows.filter((row) => /^(index |--- |\+\+\+ |diff --git)/.test(row.text)),
      [],
    )
  })

  it("penomoran mengikuti sisi lama dan sisi baru secara terpisah", () => {
    const rows = parseDiff(SATU_BERKAS).filter(
      (row) => row.kind !== "file" && row.kind !== "hunk",
    )

    assert.deepEqual(
      rows.map((row) => [row.kind, row.oldLine, row.newLine, row.text]),
      [
        ["context", 10, 10, "const satu = 1"],
        ["del", 11, undefined, "const dua = 2"],
        ["add", undefined, 11, "const dua = 22"],
        ["add", undefined, 12, "const tiga = 3"],
        ["context", 12, 13, "const empat = 4"],
      ],
    )
  })

  it("prefix +/- DIBUANG dari teks, karena gutter yang menggambarnya", () => {
    for (const row of parseDiff(SATU_BERKAS)) {
      if (row.kind === "add" || row.kind === "del") {
        assert.doesNotMatch(row.text, /^[+-]/, `prefix masih menempel: ${row.text}`)
      }
    }
  })

  it("setiap baris membawa path-nya sendiri", () => {
    /*
     * Dibawa per baris dan bukan dicari dengan memindai mundur: seleksi bekerja
     * pada indeks, dan memindai mundur dari indeks berarti setiap baris terpilih
     * membayar satu pencarian — dan satu bug ketika hunk pertama tidak punya
     * header di atasnya.
     */
    const rows = parseDiff([
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,1 +1,2 @@",
      " satu",
      "+baru",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- a/src/b.ts",
      "+++ b/src/b.ts",
      "@@ -5,1 +5,1 @@",
      "-lama",
      "+beda",
    ])

    assert.deepEqual([...new Set(rows.map((row) => row.path))], ["src/a.ts", "src/b.ts"])
    assert.equal(rows.find((row) => row.text === "baru")?.path, "src/a.ts")
    assert.equal(rows.find((row) => row.text === "lama")?.path, "src/b.ts")
  })

  it("hunk kedua melanjutkan dari angka di header-nya, bukan dari hunk sebelumnya", () => {
    const rows = parseDiff([
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,2 @@",
      " satu",
      "-dua",
      "+DUA",
      "@@ -80,2 +80,2 @@",
      " delapan",
      "-sembilan",
      "+SEMBILAN",
    ])

    const hunks = rows.filter((row) => row.kind === "hunk")
    assert.equal(hunks.length, 2)
    assert.equal(hunks[1]?.oldLine, 80)
    assert.equal(hunks[1]?.newLine, 80)
    assert.equal(rows.find((row) => row.text === "SEMBILAN")?.newLine, 81)
  })

  it("`@@ -a +b @@` tanpa jumlah tetap terbaca", () => {
    // Git menghilangkan jumlahnya saat ia 1. Regex yang menuntut koma akan diam
    // saja pada hunk satu baris, dan diam adalah cara paling mahal untuk gagal.
    const rows = parseDiff([
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -7 +7 @@",
      "-lama",
      "+baru",
    ])

    assert.equal(rows.find((row) => row.kind === "hunk")?.oldLine, 7)
    assert.equal(rows.find((row) => row.text === "baru")?.newLine, 7)
  })

  it("teks sesudah `@@` kedua dibuang, bukan ikut jadi isi", () => {
    // Git menaruh nama fungsi di sana. Berguna, tapi ia BUKAN baris kode dan
    // tidak punya nomor baris — menggambarnya sebagai konteks menggeser gutter.
    const rows = parseDiff([
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,1 +1,1 @@ function summarize()",
      "-a",
      "+b",
    ])

    const hunk = rows.find((row) => row.kind === "hunk")
    assert.equal(hunk?.oldLine, 1)
    assert.equal(hunk?.text, "")
    assert.equal(rows.find((row) => row.kind === "add")?.newLine, 1)
  })

  it("berkas biner tetap muncul sebagai berkas, tanpa baris isi", () => {
    // Kalau header berkasnya ikut hilang, user melihat panel yang mengklaim tidak
    // ada perubahan padahal ada.
    const rows = parseDiff([
      "diff --git a/logo.png b/logo.png",
      "index 1111111..2222222 100644",
      "Binary files a/logo.png and b/logo.png differ",
    ])

    assert.equal(rows.filter((row) => row.kind === "file").length, 1)
    assert.equal(rows[0]?.path, "logo.png")
    assert.deepEqual(rows.filter((row) => row.kind === "add" || row.kind === "del"), [])
  })

  it("rename tanpa hunk tetap tergambar sebagai berkas, dengan nama BARU", () => {
    // Nama lama menunjuk ke sesuatu yang tidak ada lagi di disk, dan referensi ke
    // berkas yang tidak bisa dibuka lebih buruk daripada tidak ada referensi.
    const rows = parseDiff([
      "diff --git a/src/lama.ts b/src/baru.ts",
      "similarity index 100%",
      "rename from src/lama.ts",
      "rename to src/baru.ts",
    ])

    const files = rows.filter((row) => row.kind === "file")
    assert.equal(files.length, 1)
    assert.equal(files[0]?.path, "src/baru.ts")
  })

  it("`\\ No newline at end of file` tidak menambah nomor baris", () => {
    const rows = parseDiff([
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,1 +1,1 @@",
      "-lama",
      "\\ No newline at end of file",
      "+baru",
      "\\ No newline at end of file",
    ])

    const isi = rows.filter((row) => row.kind === "add" || row.kind === "del")
    assert.deepEqual(isi.map((row) => row.text), ["lama", "baru"])
    assert.equal(isi.find((row) => row.kind === "add")?.newLine, 1)
  })

  it("masukan kosong menghasilkan nol baris, bukan satu baris kosong", () => {
    // `"".split("\n")` adalah `[""]`, dan panel yang menggambar satu baris kosong
    // terlihat seperti panel yang rusak, bukan seperti pohon kerja yang bersih.
    assert.deepEqual(parseDiff([]), [])
    assert.deepEqual(parseDiff([""]), [])
  })

  it("baris sebelum header berkas pertama tidak menjatuhkan parser", () => {
    const rows: DiffRow[] = parseDiff([
      "warning: sesuatu dari git",
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,1 +1,1 @@",
      "-a",
      "+b",
    ])

    assert.equal(rows.filter((row) => row.kind === "file").length, 1)
    assert.equal(rows.find((row) => row.kind === "add")?.path, "x")
  })
})
