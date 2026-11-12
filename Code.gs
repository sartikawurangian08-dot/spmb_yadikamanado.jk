/**
 * SPMB SMK Yadika Manado - Google Sheets bridge (dua arah)
 * - GET action=pull : membaca respons Google Form
 * - POST payload    : menerima pendaftaran dari aplikasi dan menulis ke tab offline
 * - GET action=status&requestId=... : konfirmasi hasil pengiriman
 *
 * Script Properties:
 * SPREADSHEET_ID   = ID spreadsheet pusat
 * FORM_SHEET_NAME  = nama tab respons Google Form (contoh: Form Responses 1)
 * OFFLINE_SHEET_NAME = nama tab tujuan pendaftaran offline (contoh: Pendaftaran Offline)
 * ALLOWED_EMAILS   = daftar email petugas, dipisahkan koma
 *
 * Deploy sebagai Web App: Execute as User accessing the web app;
 * Who has access: Anyone with Google account. Petugas wajib login Google
 * dengan akun yang terdaftar dan memiliki akses Editor ke spreadsheet.
 */
const OFFLINE_HEADERS = [
  'Timestamp','Email Address','NAMA LENGKAP','TEMPAT LAHIR','TANGGAL LAHIR','JENIS KELAMIN','NISN','ALAMAT TEMPAT TINGGAL','AGAMA','ASAL SEKOLAH SMP/MTs','TAHUN LULUSAN','NO.IJAZAH (Jika Sudah Memiliki Ijazah)','NOMOR HP/WA','NAMA LENGKAP AYAH','NAMA LENGKAP IBU','NAMA LENGKAP WALI (Jika ada)','NOMOR KARTU KELUARGA','PEKERJAAN ORANG TUA (Pilih salah satu Ayah/Ibu/Wali)','NOMINAL GAJI/UPAH','NOMOR HP/WA','Pilih Program Keahlian yang Diminati','ALASAN MEMILIH JURUSAN TERSEBUT','UPLOAD KARTU KELUARGA (KK)','UPLOAD PAS FOTO SISWA (Ukr 3x4)','UPLOAD FILE PENDUKUNG LAINNYA (Sertifikat)','KETERANGAN PEMBAYARAN','BUKTI PEMBAYARAN','ID Pendaftar','Nomor Registrasi','Nama lengkap calon murid','NISN','Jenis Kelamin','Tanggal Lahir','Nomor HP/WhatsApp','Asal sekolah','Program keahlian yang diminati','Nama orang tua/wali','Alamat','Status Seleksi','Sumber Pendaftaran','Waktu Pendaftaran','Waktu Pembaruan'
];

function config_() {
  const p = PropertiesService.getScriptProperties();
  const c = {
    spreadsheetId: p.getProperty('SPREADSHEET_ID'),
    formSheetName: p.getProperty('FORM_SHEET_NAME') || 'Form Responses 1',
    offlineSheetName: p.getProperty('OFFLINE_SHEET_NAME') || 'Pendaftaran Offline',
    allowedEmails: (p.getProperty('ALLOWED_EMAILS') || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  };
  if (!c.spreadsheetId) throw new Error('Script Property SPREADSHEET_ID belum diatur.');
  if (!c.allowedEmails.length) throw new Error('Script Property ALLOWED_EMAILS belum diatur.');
  return c;
}

function authorize_(c) {
  const email = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('Email Google tidak terbaca. Login dengan akun Google petugas yang diizinkan dan periksa pengaturan deployment.');
  if (c.allowedEmails.indexOf(email) === -1) throw new Error('Akun Google ' + email + ' tidak terdaftar pada ALLOWED_EMAILS.');
  return email;
}

function output_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[A-Za-z0-9_$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const q = (e && e.parameter) || {};
  try {
    const c = config_();
    authorize_(c);
    if (q.action === 'ping') return output_({ok:true, message:'SPMB bridge siap menerima dan mengirim data.'}, q.callback);
    if (q.action === 'status') {
      const raw = CacheService.getScriptCache().get('spmb_sync_' + String(q.requestId || ''));
      return output_(raw ? JSON.parse(raw) : {ok:false, pending:true, message:'Menunggu proses penyimpanan spreadsheet.'}, q.callback);
    }
    if (q.action === 'pull') return output_({ok:true, records:pullAllRecords_(c)}, q.callback);
    return output_({ok:false, error:'Aksi tidak dikenal.'}, q.callback);
  } catch (err) {
    return output_({ok:false, error:String(err.message || err)}, q.callback);
  }
}

function doPost(e) {
  let requestId = '';
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error('Payload kosong. Pastikan aplikasi menggunakan versi sinkronisasi terbaru.');
    const payload = JSON.parse(raw);
    requestId = String(payload.requestId || '');
    const c = config_();
    const email = authorize_(c);
    const records = Array.isArray(payload.records) ? payload.records : [];
    if (!records.length) throw new Error('Tidak ada data pendaftaran untuk dikirim.');
    if (records.length > 30) throw new Error('Maksimal 30 data per proses sinkronisasi.');
    const result = writeOfflineRecords_(c, records, email);
    const response = {ok:true, requestId:requestId, received:records.length, inserted:result.inserted, updated:result.updated, message:'Seluruh data berhasil disimpan ke Google Spreadsheet.'};
    if (requestId) CacheService.getScriptCache().put('spmb_sync_' + requestId, JSON.stringify(response), 21600);
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const response = {ok:false, requestId:requestId, error:String(err.message || err)};
    if (requestId) CacheService.getScriptCache().put('spmb_sync_' + requestId, JSON.stringify(response), 21600);
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  }
}

function offlineSheet_(c) {
  const ss = SpreadsheetApp.openById(c.spreadsheetId);
  let sh = ss.getSheetByName(c.offlineSheetName);
  if (!sh) sh = ss.insertSheet(c.offlineSheetName);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, OFFLINE_HEADERS.length).setValues([OFFLINE_HEADERS]);
    sh.setFrozenRows(1);
  } else {
    const current = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0].map(x => String(x).trim());
    const isOnlyTimestamp = current.length === 1 && current[0].toLowerCase() === 'timestamp';
    if (isOnlyTimestamp) {
      // Pertahankan nilai Timestamp lama di kolom A; lengkapi judul kolom B:AP.
      sh.getRange(1, 1, 1, OFFLINE_HEADERS.length).setValues([OFFLINE_HEADERS]);
      sh.setFrozenRows(1);
    } else {
      const matches = OFFLINE_HEADERS.every((h, i) => current[i] === h);
      if (!matches) throw new Error('Struktur tab "' + c.offlineSheetName + '" belum sesuai 42 kolom. Buat tab baru bernama "' + c.offlineSheetName + '" atau kosongkan tab yang hanya berisi header lama, lalu coba lagi. Data lama tidak dihapus otomatis.');
    }
  }
  return sh;
}

function recordToRow_(r, email) {
  const now = new Date();
  const created = r.createdAt ? new Date(r.createdAt) : now;
  const updated = r.updatedAt ? new Date(r.updatedAt) : created;
  const parentName = r.guardian || [r.father, r.mother].filter(Boolean).join(' / ');
  const docs = r.docs || {};
  const fileNames = r.fileNames || {};
  return [
    created, r.email || email || '', r.name || '', r.birthPlace || '', r.birthDate || '', r.gender || '', r.nisn || '', r.address || '', r.religion || '', r.originSchool || '', r.gradYear || '', r.diplomaNumber || '', r.phone || '', r.father || '', r.mother || '', r.guardian || '', r.familyCardNumber || '', r.parentOccupation || '', r.parentIncome || '', r.parentPhone || '', r.major || '', r.reason || '', fileNames.kk || '', fileNames.photo || '', fileNames.certificate || '', r.paymentNote || '', fileNames.paymentProof || '', r.id || '', r.number || '', r.name || '', r.nisn || '', r.gender || '', r.birthDate || '', r.phone || '', r.originSchool || '', r.major || '', parentName, r.address || '', r.status || 'Menunggu', r.source || 'offline', created, updated
  ];
}

function writeOfflineRecords_(c, records, email) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = offlineSheet_(c);
    const last = sh.getLastRow();
    const idCol = 28;
    const idRows = last >= 2 ? sh.getRange(2, idCol, last - 1, 1).getDisplayValues() : [];
    const rowById = {};
    idRows.forEach((v, i) => { if (v[0]) rowById[v[0]] = i + 2; });
    let inserted = 0, updated = 0;
    records.forEach(r => {
      if (!r || !r.id) throw new Error('Ada data tanpa ID Pendaftar. Simpan ulang data tersebut dari aplikasi.');
      const row = recordToRow_(r, email);
      const target = rowById[r.id];
      if (target) { sh.getRange(target, 1, 1, OFFLINE_HEADERS.length).setValues([row]); updated++; }
      else { sh.appendRow(row); rowById[r.id] = sh.getLastRow(); inserted++; }
    });
    return {inserted:inserted, updated:updated};
  } finally {
    lock.releaseLock();
  }
}

function pullFormRecords_(c) {
  const ss = SpreadsheetApp.openById(c.spreadsheetId);
  const sheet = ss.getSheetByName(c.formSheetName);
  if (!sheet) throw new Error('Tab respons online "' + c.formSheetName + '" tidak ditemukan.');
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim().toLowerCase());
  const out = [];
  values.forEach((row, index) => {
    const obj = {}; headers.forEach((h, j) => obj[h] = row[j] == null ? '' : row[j]);
    const get = terms => { const key = headers.find(h => terms.some(t => h.includes(t))); return key ? obj[key] : ''; };
    const asText = value => value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(value == null ? '' : value);
    const tv = get(['timestamp', 'stempel waktu', 'cap waktu']);
    const timestamp = tv instanceof Date ? tv.toISOString() : (tv ? (isNaN(new Date(tv).getTime()) ? '' : new Date(tv).toISOString()) : '');
    const name = asText(get(['nama lengkap', 'nama siswa', 'nama peserta', 'nama calon', 'nama'])).trim();
    if (!name) return;
    const stableId = 'FORM-' + Utilities.base64EncodeWebSafe((timestamp || 'row-' + (index + 2)) + '|' + name).replace(/=+$/g, '');
    out.push({
      id:stableId, number:'', name:name, nisn:asText(get(['nisn'])), gender:asText(get(['jenis kelamin'])),
      birthPlace:asText(get(['tempat lahir'])), birthDate:asText(get(['tanggal lahir', 'tgl lahir'])),
      address:asText(get(['alamat tempat tinggal', 'alamat lengkap', 'alamat'])), religion:asText(get(['agama'])),
      phone:asText(get(['nomor hp', 'no hp', 'whatsapp', 'telepon', 'nomor wa', 'no. wa'])), email:asText(get(['email address', 'alamat email', 'email'])),
      originSchool:asText(get(['asal sekolah smp', 'smp', 'mts', 'sekolah asal'])), gradYear:asText(get(['tahun lulusan', 'tahun lulus'])),
      diplomaNumber:asText(get(['no.ijazah', 'nomor ijazah'])), father:asText(get(['nama lengkap ayah', 'nama ayah'])),
      mother:asText(get(['nama lengkap ibu', 'nama ibu'])), guardian:asText(get(['nama lengkap wali', 'nama wali'])),
      familyCardNumber:asText(get(['nomor kartu keluarga', 'nomor kk'])), parentOccupation:asText(get(['pekerjaan orang tua'])),
      parentIncome:asText(get(['nominal gaji', 'nominal upah', 'penghasilan'])), parentPhone:asText(get(['nomor hp/wa orang tua', 'nomor hp orang tua', 'nomor orang tua', 'kontak orang tua'])),
      major:asText(get(['pilih program keahlian', 'program keahlian', 'jurusan'])), reason:asText(get(['alasan memilih jurusan'])),
      paymentNote:asText(get(['keterangan pembayaran'])), source:'online', status:'Menunggu', notes:'',
      createdAt:timestamp || new Date().toISOString(), updatedAt:timestamp || new Date().toISOString(), docs:{}, fileNames:{}
    });
  });
  return out;
}


/** Menggabungkan pendaftar offline dari tab pusat dan respons Google Form. */
function pullAllRecords_(c) {
  return pullFormRecords_(c).concat(pullOfflineRecords_(c));
}

function pullOfflineRecords_(c) {
  const ss = SpreadsheetApp.openById(c.spreadsheetId);
  const sh = ss.getSheetByName(c.offlineSheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const rows = values.slice(1);
  const asText = v => v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v == null ? '' : v);
  const asIso = v => {
    if (v instanceof Date) return v.toISOString();
    const d = v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.toISOString() : '';
  };
  return rows.map(row => {
    const created = asIso(row[40]) || asIso(row[0]) || new Date().toISOString();
    const updated = asIso(row[41]) || created;
    const guardian = asText(row[15]);
    return {
      id:asText(row[27]), number:asText(row[28]), name:asText(row[2] || row[29]),
      birthPlace:asText(row[3]), birthDate:asText(row[4] || row[32]), gender:asText(row[5] || row[31]),
      nisn:asText(row[6] || row[30]), address:asText(row[7] || row[37]), religion:asText(row[8]),
      originSchool:asText(row[9] || row[34]), gradYear:asText(row[10]), diplomaNumber:asText(row[11]),
      phone:asText(row[12] || row[33]), email:asText(row[1]), father:asText(row[13]), mother:asText(row[14]),
      guardian:guardian, familyCardNumber:asText(row[16]), parentOccupation:asText(row[17]), parentIncome:asText(row[18]),
      parentPhone:asText(row[19]), major:asText(row[20] || row[35]), reason:asText(row[21]),
      fileNames:{kk:asText(row[22]),photo:asText(row[23]),certificate:asText(row[24]),paymentProof:asText(row[26])},
      paymentNote:asText(row[25]), status:asText(row[38]) || 'Menunggu', source:asText(row[39]) || 'offline',
      createdAt:created, updatedAt:updated, notes:'', docs:{}, syncState:'synced'
    };
  }).filter(r => r.id && r.name);
}
