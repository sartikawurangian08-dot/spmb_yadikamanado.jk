SPMB SMK YADIKA MANADO 2027/2028 - V3 SINKRONISASI SPREADSHEET

FITUR VERSI INI
- Sinkronisasi dua arah: aplikasi mengirim pendaftaran offline ke Google Sheets dan menarik respons Google Form.
- Seluruh 42 kolom data yang diminta dipetakan ke tab Pendaftaran Offline.
- Data yang belum terkirim tetap tersimpan pada perangkat (IndexedDB) dan masuk antrean.
- Draf formulir disimpan otomatis ketika petugas mengetik dan dipulihkan saat aplikasi dibuka kembali pada perangkat/browser yang sama.
- Ketika internet tersedia, aplikasi mencoba mengirim antrean secara otomatis; petugas juga dapat menekan Sinkronkan Semua Data.
- ID Pendaftar digunakan sebagai kunci untuk mencegah baris ganda. Pengiriman ulang memperbarui baris yang sama.
- Jika tab Pendaftaran Offline belum ada, Apps Script membuatnya dan menyiapkan header 42 kolom.
- Jika tab tujuan hanya memiliki header Timestamp, Apps Script melengkapi 41 header lainnya dan mempertahankan nilai Timestamp lama pada kolom pertama. Struktur tab lain yang tidak cocok akan menghasilkan pesan kesalahan agar data lama tidak tertimpa.
- Form offline mencakup agama, nomor ijazah, nomor KK, pekerjaan orang tua, nominal gaji/upah, alasan memilih jurusan, keterangan pembayaran, dan nama berkas.

CATATAN PENTING TENTANG BERKAS
Kolom upload KK, pas foto, sertifikat, dan bukti pembayaran untuk saat ini mengirim NAMA FILE ke spreadsheet. File fisiknya belum diunggah ke Google Drive. Upload fisik membutuhkan pengaturan folder Drive dan izin tambahan.

MULAI APLIKASI
1. Ekstrak ZIP.
2. Jalankan JALANKAN-LOKAL-WINDOWS.bat (Windows), atau jalankan `python -m http.server 8000` dari folder aplikasi.
3. Buka http://localhost:8000.
4. Login awal: Admin / Yadika2027. Segera ubah password melalui Pengaturan.

MENYIAPKAN GOOGLE SHEETS
1. Buka spreadsheet yang akan menjadi pusat data.
2. Pastikan respons Google Form sudah ditautkan ke spreadsheet tersebut.
3. Catat ID spreadsheet (teks di antara /d/ dan /edit pada URL).
4. Catat nama tab respons Google Form persis, misalnya Form Responses 1.
5. Tab tujuan pendaftaran offline akan bernama Pendaftaran Offline (atau nama yang ditentukan pada Script Properties).

MENYIAPKAN APPS SCRIPT
1. Dari spreadsheet pusat, pilih Extensions > Apps Script.
2. Ganti seluruh isi Code.gs dengan file google-apps-script/Code.gs dari paket ini.
3. Buka Project Settings > Script Properties, lalu isi:
   SPREADSHEET_ID = ID spreadsheet pusat
   FORM_SHEET_NAME = nama tab respons Google Form (contoh: Form Responses 1)
   OFFLINE_SHEET_NAME = Pendaftaran Offline
   ALLOWED_EMAILS = email petugas dipisahkan koma, contoh: admin@sekolah.sch.id,petugas1@gmail.com
4. Berikan akses Editor spreadsheet hanya kepada petugas yang berwenang dan daftarkan email mereka pada ALLOWED_EMAILS.
5. Deploy > New deployment > Web app.
6. Execute as: User accessing the web app.
7. Who has access: Anyone with Google account.
8. Deploy dan setujui izin yang diminta. Salin URL Web App yang berakhir dengan /exec.
9. Jika kode diubah, buka Deploy > Manage deployments > Edit, pilih New version, lalu Deploy.

MENGHUBUNGKAN APLIKASI
1. Login ke aplikasi melalui Chrome/HTTPS atau localhost.
2. Pastikan Chrome juga login ke akun Google petugas yang ada di ALLOWED_EMAILS.
3. Buka menu Sinkronisasi Data.
4. Tempel URL Web App /exec.
5. Klik Simpan URL, lalu Uji koneksi. Pesan yang diharapkan: koneksi dua arah berhasil.
6. Isi satu data uji (gunakan data dummy, bukan data pribadi siswa), tekan Simpan Pendaftaran.
7. Dengan internet aktif, aplikasi mencoba sinkronisasi otomatis. Untuk mengirim manual, tekan Sinkronkan Semua Data.
8. Periksa tab Pendaftaran Offline di spreadsheet. Pastikan seluruh kolom terisi, bukan hanya Timestamp.

CARA KERJA SINKRONISASI
- POST dari aplikasi mengirim data ke doPost Apps Script.
- Apps Script menulis/memperbarui baris berdasarkan ID Pendaftar.
- Aplikasi memeriksa status penyimpanan melalui endpoint status sebelum menandai data sebagai tersinkron.
- GET action=pull mengambil respons Google Form sekaligus data offline dari tab pusat agar petugas di perangkat lain dapat melihat data yang sama.
- Pendaftaran offline ditulis ke tab Pendaftaran Offline, bukan ke tab respons Google Form. Kedua tab berada dalam spreadsheet pusat yang sama.

KEAMANAN DAN BATASAN
- Data calon siswa termasuk data pribadi. Jangan gunakan spreadsheet publik atau endpoint tanpa pembatasan akun.
- Deployment harus mensyaratkan login Google dan ALLOWED_EMAILS. Jangan pilih akses anonim/public.
- Setiap petugas harus login ke akun Google yang diizinkan dan memiliki akses Editor ke spreadsheet.
- Login Admin pada aplikasi statis hanya login lokal di browser; bukan autentikasi server untuk melindungi data lintas perangkat. Untuk operasional multi-petugas, hosting dan autentikasi server perlu ditingkatkan.
- Data yang belum berhasil mendapat konfirmasi tetap berada di perangkat dan antrean akan dicoba lagi.
- Data lokal pada perangkat berbeda tidak otomatis berbagi sampai berhasil dikirim ke spreadsheet pusat.
- Backup JSON/CSV mengandung data pribadi, simpan secara aman.

AKUN ADMINISTRATOR AWAL
Username: Admin
Password: Yadika2027
Segera ganti password awal.

FILE PAKET
- index.html, style.css, app.js: aplikasi web.
- manifest.json, service-worker.js: dukungan PWA/offline cache.
- google-apps-script/Code.gs: jembatan Google Sheets dua arah.
- assets/poster-spmb-reference.png: poster referensi.
