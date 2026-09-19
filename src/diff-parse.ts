/**
 * Mengubah keluaran `git diff` jadi baris berstruktur yang MEMBAWA nomornya.
 *
 * Panel lama menggambar teks diff apa adanya. Itu cukup untuk dibaca, tapi tidak
 * cukup untuk apa pun yang lain: gutter butuh nomor baris untuk digambar, dan
 * referensi `@path:awal-akhir` butuh nomor baris untuk dihitung. Keduanya ada di
 * dalam teks diff — di header hunk — dan yang dilakukan berkas ini hanyalah
 * menghitungnya sekali, di satu tempat, alih-alih menebaknya berkali-kali.
 *
 * Murni dan tanpa I/O, sama seperti `layout.ts`: inilah bagian yang paling mudah
 * salah dan paling murah diuji.
 */

export type DiffKind = "file" | "hunk" | "add" | "del" | "context"

export interface DiffRow {
  kind: DiffKind
  /**
   * Berkas pemilik baris ini.
   *
   * Dibawa PER BARIS dan bukan dicari dengan memindai mundur. Seleksi bekerja
   * pada indeks, jadi memindai mundur berarti setiap baris terpilih membayar
   * satu pencarian — dan satu bug diam pada baris yang kebetulan tidak punya
   * header di atasnya.
   */
  path: string
  /** Nomor di sisi LAMA. Kosong pada baris tambahan. */
  oldLine?: number
  /** Nomor di sisi BARU. Kosong pada baris hapusan. */
  newLine?: number
  /** Isi baris, TANPA prefix `+`/`-`/spasi. */
  text: string
}

/*
 * Jumlahnya opsional: git menghilangkannya saat ia 1, jadi `@@ -7 +7 @@` sah.
 * Regex yang menuntut koma akan diam saja pada setiap hunk satu baris.
 */
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/**
 * @param lines keluaran `git diff` yang sudah dipecah per baris
 */
export function parseDiff(lines: string[]): DiffRow[] {
  const rows: DiffRow[] = []

  let path = ""
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (line === "") continue

    if (line.startsWith("diff --git ")) {
      path = pathOf(line)
      if (path !== "") rows.push({ kind: "file", path, text: path })
      continue
    }

    /*
     * Noise mesin, dibuang seluruhnya.
     *
     * `index`, `--- a/`, `+++ b/`, `similarity index`, `rename from|to`, dan
     * baris mode tidak pernah berarti apa pun bagi yang membaca panel, dan di
     * panel selebar dua puluh kolom setiap baris yang tidak berarti mengusir
     * satu baris yang berarti.
     *
     * `+++`/`---` diperiksa SEBELUM `+`/`-`: kebalikannya membuat header berkas
     * terbaca sebagai baris tambahan dan ikut mendapat nomor.
     */
    if (
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("old mode ") ||
      line.startsWith("new mode ") ||
      line.startsWith("deleted file mode ") ||
      line.startsWith("new file mode ") ||
      line.startsWith("similarity index ") ||
      line.startsWith("dissimilarity index ") ||
      line.startsWith("rename from ") ||
      line.startsWith("rename to ") ||
      line.startsWith("copy from ") ||
      line.startsWith("copy to ") ||
      line.startsWith("Binary files ") ||
      line.startsWith("GIT binary patch")
    ) {
      continue
    }

    const hunk = HUNK.exec(line)
    if (hunk) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      /*
       * Teks sesudah `@@` kedua — git menaruh nama fungsi di sana — sengaja
       * TIDAK dibawa. Ia berguna, tapi ia bukan baris kode: memberinya nomor
       * baris menggeser seluruh gutter sesudahnya.
       */
      rows.push({ kind: "hunk", path, oldLine, newLine, text: "" })
      continue
    }

    /*
     * Penanda "tidak ada newline di akhir berkas". Ia menerangkan baris
     * SEBELUMNYA, bukan baris baru — menghitungnya akan memajukan nomor satu
     * langkah dan membuat setiap baris sesudahnya meleset.
     */
    if (line.startsWith("\\")) continue

    // Di luar hunk mana pun (mis. peringatan git di awal keluaran): tidak ada
    // nomor yang bisa diberikan, jadi tidak ada yang digambar.
    if (path === "") continue

    const marker = line[0]
    const text = line.slice(1)

    if (marker === "+") {
      rows.push({ kind: "add", path, newLine, text })
      newLine += 1
      continue
    }
    if (marker === "-") {
      rows.push({ kind: "del", path, oldLine, text })
      oldLine += 1
      continue
    }

    rows.push({ kind: "context", path, oldLine, newLine, text })
    oldLine += 1
    newLine += 1
  }

  return rows
}

/**
 * Menarik nama berkas dari `diff --git a/<lama> b/<baru>`.
 *
 * Yang diambil adalah nama BARU. Pada rename, nama lama menunjuk ke sesuatu
 * yang tidak ada lagi di disk — dan referensi ke berkas yang tidak bisa dibuka
 * lebih buruk daripada tidak ada referensi.
 *
 * Diurai dari ` b/` yang TERAKHIR, bukan yang pertama: nama berkas boleh memuat
 * " b/" di tengahnya, dan pemisahan pada yang pertama memotongnya di situ.
 */
function pathOf(line: string): string {
  const rest = line.slice("diff --git ".length)
  const at = rest.lastIndexOf(" b/")
  if (at === -1) return ""
  return rest.slice(at + " b/".length)
}
