import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { layout, moveCursor, planView, truncateEnd, truncateStart } from "../src/layout.ts"

describe("layout", () => {
  it("budget menyisakan SATU baris, untuk hint", () => {
    /*
     * Dulu dua — satu untuk hint dan satu untuk tab bar — padahal tab bar
     * mendorong satu baris PER TAB, jadi dua tab memakan tiga baris dari jatah
     * dua. Panel menggambar satu baris lebih banyak daripada yang direservasi
     * host, dan test lama justru mengunci perilaku itu.
     *
     * Tab sudah hilang, jadi sekarang angkanya benar-benar satu.
     */
    assert.equal(layout({ rows: 10, cursor: 0, contentLines: 20 }).budget, 9)
  })

  it("jumlah baris yang direncanakan TIDAK PERNAH melebihi jatahnya", () => {
    // Inilah yang sebenarnya dijaga oleh aritmetika di atas. Menguji `budget`
    // saja membiarkan planView menambah baris sendiri tanpa ketahuan.
    for (const rows of [2, 3, 5, 10, 40]) {
      const plan = planView({ rows, cursor: 0, contentLines: 500, emptyLabel: "clean" })
      assert.ok(plan.length <= rows, `rows=${rows} menghasilkan ${plan.length} baris`)
    }
  })

  it("panel yang terlalu pendek tidak menggambar isi sama sekali", () => {
    const plan = planView({ rows: 1, cursor: 0, contentLines: 50, emptyLabel: "clean" })
    assert.deepEqual(plan.map((row) => row.kind), ["hint"])
  })

  it("tanpa isi, yang tergambar adalah label kosong lalu hint", () => {
    const plan = planView({ rows: 5, cursor: 0, contentLines: 0, emptyLabel: "clean" })
    assert.deepEqual(plan.map((row) => row.kind), ["empty", "hint"])
  })

  it("baris konten membawa indeksnya sendiri, supaya klik bisa dipetakan", () => {
    /*
     * Inilah yang selama ini hilang: `onClick` menerima indeks baris TERGAMBAR,
     * dan tanpa offset ia tidak bisa tahu baris data mana yang dimaksud. Panel
     * lama menuliskan itu sebagai komentar lalu mengembalikan `refresh` saja.
     */
    const plan = planView({ rows: 4, cursor: 10, contentLines: 50, emptyLabel: "clean" })
    const content = plan.filter((row) => row.kind === "content")

    assert.deepEqual(content.map((row) => row.index), [8, 9, 10])
    assert.equal(content.filter((row) => row.cursor).length, 1)
    assert.equal(content.find((row) => row.cursor)?.index, 10)
  })

  it("jendela mengikuti kursor ke bawah, dan berhenti di ujung", () => {
    const awal = planView({ rows: 4, cursor: 0, contentLines: 50, emptyLabel: "clean" })
    assert.deepEqual(awal.filter((r) => r.kind === "content").map((r) => r.index), [0, 1, 2])

    const akhir = planView({ rows: 4, cursor: 49, contentLines: 50, emptyLabel: "clean" })
    assert.deepEqual(akhir.filter((r) => r.kind === "content").map((r) => r.index), [47, 48, 49])
  })

  it("seleksi menandai SETIAP baris di dalam rentangnya, bukan hanya ujungnya", () => {
    const plan = planView({
      rows: 8,
      cursor: 4,
      contentLines: 10,
      selection: { from: 2, to: 4 },
      emptyLabel: "clean",
    })

    const selected = plan.filter((row) => row.kind === "content" && row.selected)
    assert.deepEqual(selected.map((row) => (row.kind === "content" ? row.index : -1)), [2, 3, 4])
  })

  it("seleksi yang seluruhnya di luar jendela tidak menandai apa pun", () => {
    const plan = planView({
      rows: 4,
      cursor: 40,
      contentLines: 50,
      selection: { from: 0, to: 2 },
      emptyLabel: "clean",
    })
    assert.equal(plan.filter((row) => row.kind === "content" && row.selected).length, 0)
  })

  it("moveCursor berhenti di kedua ujung", () => {
    assert.equal(moveCursor(0, -1, 10), 0)
    assert.equal(moveCursor(9, 1, 10), 9)
    assert.equal(moveCursor(5, -3, 10), 2)
    // Daftar kosong tidak punya baris nol untuk ditunjuk.
    assert.equal(moveCursor(3, 1, 0), 0)
  })

  it("truncateEnd memotong kode dari BELAKANG", () => {
    assert.equal(truncateEnd("hello world", 8), "hello w…")
    assert.equal(truncateEnd("hi", 5), "hi")
  })

  it("truncateStart memotong path dari DEPAN, karena ekornya yang informatif", () => {
    // `src/tui/…` memberi tahu lebih sedikit daripada `…/tui/app.tsx`.
    assert.equal(truncateStart("src/core/agent.ts", 10), "…/agent.ts")
    assert.equal(truncateStart("a.ts", 10), "a.ts")
  })
})
