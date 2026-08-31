# Ringkasan Perbaikan LeoBot

## ⚠️ WAJIB: jalankan migrasi database dulu

Sebelum deploy, jalankan `migrations/0001_fulfillment_and_cron.sql`
di Supabase SQL Editor. Tanpa ini, pengiriman produk otomatis dan
cron VIP akan error karena kolom/tabel yang dipakai belum ada.

## 1. Pengiriman produk otomatis setelah bayar (fitur yang hilang total)

**Sebelumnya:** `processPaymentSuccess()` di `payment.js` cuma
mengubah status order jadi `PAID`, lalu berhenti. Tidak ada file
digital yang dikirim, tidak ada invite link VIP yang dibuat.
Customer bayar tapi tidak menerima apa pun kecuali admin kirim
manual.

**Sekarang:** file baru `src/fulfillment.js` menangani pengiriman:
- **Produk Digital** → file dikirim ulang ke customer memakai method
  Telegram yang sesuai jenis medianya (foto tetap `sendPhoto`, video
  tetap `sendVideo`, dst — bukan cuma `file_id` mentah lewat satu
  method). Makanya ada kolom baru `products.file_type` yang direkam
  otomatis setiap kali admin upload/ganti file produk digital.
- **Produk VIP** → dibuatkan invite link sekali-pakai
  (`member_limit: 1`) untuk tiap channel yang terhubung ke produk
  itu, dikirim ke customer, dan dicatat di tabel baru
  `vip_memberships` (dipakai cron untuk reminder & auto-kick).
- Template pesan yang admin edit di menu "✏️ PESAN BOT"
  (Pembayaran Berhasil, Produk Digital Terkirim, VIP Aktif) sekarang
  benar-benar terpakai, bukan cuma tersimpan di database tanpa
  fungsi.
- Kalau pengiriman gagal (mis. bot bukan admin channel lagi), order
  ditandai `DELIVERY_FAILED` supaya kelihatan di data, bukan diam-diam
  hilang.

## 2. Cron job (sebelumnya tidak ada sama sekali)

File baru `src/cron.js` + `scheduled` export baru di `index.js` +
`[triggers] crons = ["*/10 * * * *"]` di `wrangler.toml`:
- Order `PENDING` yang QR-nya sudah kedaluwarsa tapi tidak pernah
  dibayar → otomatis jadi `EXPIRED` (sebelumnya nyangkut selamanya).
- Member VIP yang masa aktifnya akan habis dalam 24 jam → dikirim
  reminder sekali.
- Member VIP yang masa aktifnya sudah habis → otomatis di-kick
  (ban+unban) dari channel dan diberi tahu lewat DM.

## 3. Bug upsert Supabase (race condition state admin)

**Sebelumnya:** semua fungsi `saveState`/`setSetting` di 5 file
berbeda memakai `POST` + `Prefer: resolution=merge-duplicates`
**tanpa** `?on_conflict=key`. Kalau kolom `key` di tabel `settings`
bukan primary key, ini bisa gagal (409) atau bikin baris dobel —
dan karena pembacaan state pakai `limit=1` tanpa `order by`, hasil
bisa jadi baris yang salah/lama.

**Sekarang:** `upsertSetting()` baru di `supabase.js` mencoba
`PATCH` (update) dulu berdasarkan `key`; kalau tidak ada baris yang
cocok, baru `POST` (insert). Ini aman untuk skema apa pun, dengan
atau tanpa unique constraint di kolom `key`.

Sekaligus dirapikan: `saveState`/`getState`/`deleteState` yang
tadinya diduplikasi terpisah di `channel.js`, `messages.js`,
`digital.js`, `products.js`, dan `payment.js` sekarang satu sumber
di `src/state.js`.

## 4. Menu admin yang tidak konsisten

**Sebelumnya:** perintah `/admin` menampilkan menu dengan tombol
"PESAN BOT" tapi tanpa "PENGATURAN". Tombol "◀️ KEMBALI" dari dalam
panel (`admin:menu`) menampilkan menu sebaliknya — ada "PENGATURAN",
tidak ada "PESAN BOT". Begitu admin masuk lewat `/admin` lalu pindah
menu dan tekan kembali, fitur edit pesan bot jadi tidak bisa diakses
lagi tanpa ketik `/admin` ulang.

**Sekarang:** satu keyboard menu (`buildAdminMenuKeyboard` di
`admin/menu.js`) dipakai di kedua jalur masuk — berisi PRODUK,
PEMBAYARAN, CHANNEL VIP, PESAN BOT, dan PENGATURAN.

## 5. Kondisi balapan (race condition) di pemrosesan webhook

**Sebelumnya:** `processPaymentSuccess` fetch order dulu, cek
statusnya di JavaScript, baru update — ada celah waktu antara cek
dan update yang secara teori bisa membuat webhook duplikat (retry
dari payment gateway) memproses pembayaran & mengirim produk dua
kali.

**Sekarang:** update memakai kondisi `status=eq.PENDING` langsung di
query PATCH (atomik di level database). Webhook kedua yang datang
untuk order yang sama tidak akan menemukan baris PENDING lagi,
otomatis berhenti tanpa efek samping.

## 6. Menu "⚙️ PENGATURAN" sekarang berfungsi (sebelumnya placeholder kosong)

Semua ini bisa diatur langsung dari bot, tanpa ubah kode, dan
langsung berlaku di tampilan customer:

- **🖼️ Foto Banner Welcome** — kirim foto ke bot, otomatis
  terpasang sebagai banner yang muncul bersama pesan `/start`.
  (Catatan: Telegram tidak bisa mengubah pesan teks jadi pesan
  foto, jadi banner cuma tampil saat mengirim pesan baru — bukan
  saat customer tekan tombol "◀️ KEMBALI" ke menu yang sudah ada.)
- **📞 Kontak CS** — begitu diisi, tombol "📞 HUBUNGI CS" otomatis
  muncul di menu utama.
- **💰 Format Harga** — pilih pemisah ribuan (titik/koma) dan ubah
  prefix mata uang. Langsung berlaku di semua tampilan harga yang
  dilihat customer.
- **🔘 Label Tombol** — ubah teks tombol "BAYAR" dan "KEMBALI"
  sesuka hati (termasuk emoji-nya).

Nama toko & isi pesan sambutan sendiri sebenarnya sudah bisa
diedit sebelumnya lewat menu "✏️ PESAN BOT" → "👋 WELCOME" — jadi
tidak dibuat pengaturan terpisah supaya tidak ada dua tempat yang
mengatur hal yang sama.

Bonus fix: pesan **"🧾 DETAIL PRODUK"** di menu PESAN BOT ternyata
sebelumnya tidak pernah benar-benar dipakai — `showProduct` menulis
teksnya sendiri secara hardcoded. Sekarang benar-benar memakai
template itu, jadi mengedit pesan itu di bot sungguhan mengubah apa
yang dilihat customer.

Tidak butuh migrasi database tambahan untuk fitur ini — semua
numpang di tabel `settings` yang sudah ada.

## 7. Kredensial pembayaran tersimpan plaintext + tidak bisa dihapus

**Sebelumnya:** `secret_token` (dipakai untuk memanggil API BuatQris)
dan `webhook_secret` (dipakai untuk **validasi tanda tangan
webhook**) tersimpan polos di tabel `settings`. Ini serius: kalau
`webhook_secret` bocor (mis. lewat akses Supabase yang tidak
seharusnya, backup yang ke-expose, dsb), orang bisa memalsukan
webhook `payment.success` dan **dapat produk/VIP tanpa bayar**.
Selain itu, tidak ada tombol untuk menghapus kredensial — cuma bisa
ditimpa dengan nilai baru.

**Sekarang:**
- File baru `src/crypto.js` — enkripsi AES-256-GCM pakai Web Crypto
  API bawaan Cloudflare Workers (tidak perlu library tambahan).
  `secret_token` dan `webhook_secret` dienkripsi sebelum disimpan,
  didekripsi saat dipakai. **Butuh secret baru:**
  `wrangler secret put ENCRYPTION_KEY` (isi bebas, string acak
  panjang — bisa pakai `openssl rand -base64 32`).
- `account_id` sengaja TIDAK dienkripsi — ini cuma identifier akun
  (mirip username), bukan kredensial rahasia yang bisa dipakai
  langsung untuk transaksi/validasi. Kalau kamu mau ikut dienkripsi
  juga, tinggal bilang, gampang ditambahkan.
- Tombol **"🗑️ HAPUS NILAI INI"** sekarang muncul di layar edit
  Account ID / Secret Token / Webhook Secret (kalau nilainya sudah
  diisi), dengan layar konfirmasi yang menjelaskan konsekuensinya
  sebelum benar-benar dihapus.
- Kalau `ENCRYPTION_KEY` belum diset atau salah, bot tidak crash —
  kredensial akan terbaca sebagai "belum diatur" (fail-safe, bukan
  fail-open) dan errornya tercatat di log Cloudflare Worker.

## Belum dikerjakan (di luar scope kali ini, FYI)

- Menu "⚙️ PENGATURAN" di admin panel masih placeholder ("belum
  tersedia") — ini bukan bug baru, memang belum pernah dibangun.
- Tidak ada retry otomatis untuk order berstatus `DELIVERY_FAILED`
  (perlu dikirim ulang manual oleh admin untuk saat ini).
