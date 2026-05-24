# SPEC: Manager on Duty (MOD)

## Overview
Sistem Manager on Duty untuk menentukan siapa manager/SPV yang sedang bertugas di hari Jumat, Sabtu, Minggu.

## Schedule MOD - Per Tanggal
- **Jumat**: Manager
- **Sabtu**: SPV Sales
- **Minggu**: SPV Sales (ajatah)

## User Roles & Permissions
| Role | Create Schedule | Edit Schedule | Delete Schedule | Create/Edit Template | Submit Report | Review Report | View Dashboard |
|------|----------------|---------------|----------------|---------------------|---------------|---------------|----------------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| HR | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| SPV | ❌ | ❌ | ❌ | ❌ | Jika MOD | ❌ | ✅ |
| Manager | ❌ | ❌ | ❌ | ❌ | Jika MOD | ❌ | ✅ |

## Firestore Collections

### `mod_schedules` (per tanggal)
```typescript
{
  id: string,
  date: string,           // YYYY-MM-DD
  dayOfWeek: "friday" | "saturday" | "sunday",
  userId: string,
  userName: string,
  department: string,
  role: "manager" | "spv",
  notes: string,
  createdAt: timestamp,
  createdBy: string,
  createdByName: string,
  updatedAt: timestamp,
  updatedBy: string,
  updatedByName: string
}
```

### `mod_templates`
```typescript
{
  id: string,
  name: string,
  description: string,
  isActive: boolean,
  areas: MODArea[],
  createdBy: string,
  createdByName: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Where `MODArea`:
```typescript
{
  name: string,
  order: number,
  questions: MODQuestion[]
}
```

And `MODQuestion`:
```typescript
{
  text: string,
  needPhoto: boolean,
  needNote: boolean,
  actionRequired: boolean
}
```

### `mod_reports`
```typescript
{
  id: string,
  scheduleId: string,     // reference ke mod_schedules
  date: string,           // YYYY-MM-DD
  dayOfWeek: "friday" | "saturday" | "sunday",
  templateId: string,
  templateName: string,
  areaAnswers: AreaAnswer[],  // Jawaban per area
  photos: [               // Foto global (deprecated, now per-question)
    {
      id: string,
      fieldId: string,
      url: string,
      caption: string,
      originalSize: number,
      compressedSize: number,
      uploadedAt: timestamp
    }
  ],
  problems: ProblemFound[],   // Daftar masalah
  generalNotes: string,
  submittedBy: string,
  submittedByName: string,
  submittedAt: timestamp,
  status: "draft" | "submitted" | "reviewed",
  reviewedBy: string,
  reviewedByName: string,
  reviewedAt: timestamp,
  reviewNotes: string,
  createdAt: timestamp
}
```

Where `AreaAnswer`:
```typescript
{
  name: string,
  order: number,
  questions: QuestionAnswer[]
}
```

And `QuestionAnswer`:
```typescript
{
  text: string,
  needPhoto: boolean,
  needNote: boolean,
  actionRequired: boolean,
  isChecked: boolean,
  note: string,
  photos: QuestionPhoto[]
}
```

And `ProblemFound`:
```typescript
{
  id: string,
  description: string,
  priority: "low" | "medium" | "high",
  assignedTo: string,
  linkedWO?: { id: string, woNumber: string, title: string }
}
```

## Pages

### `/manager-on-duty` - List Jadwal MOD
- Calendar view jadwal MOD per bulan
- Filter by bulan/tahun
- List per tanggal (Jumat, Sabtu, Minggu)
- Tombol buat/edit jadwal (HRD)
- Tombol hapus jadwal (Super Admin only)
- Quick link ke dashboard, template, laporan

### `/manager-on-duty/schedule` - Form Buat/Edit Jadwal MOD
- Pilih tanggal (auto validasi: hanya Jumat/Sabtu/Minggu)
- Toggle: Manager atau SPV Sales
- Dropdown pilih user yang bertugas
- Notes/remarks
- Tombol simpan/update (HRD/Admin)
- Tombol hapus (Super Admin only)

### `/manager-on-duty/template` - Kelola Template MOD
- List semua template
- Area-based structure (bukan field builder)
- Tambah/edit/hapus area
- Tiap area punya list pertanyaan dengan:
  - Text pertanyaan
  - needPhoto (boolean)
  - needNote (boolean)
  - actionRequired (boolean)
- Toggle aktif/nonaktif template
- Delete template (Super Admin)
- Default template: 5 area × 5 pertanyaan (Front Office, Housekeeping, Public Area, Kitchen & Restaurant, Security & Safety)

### `/manager-on-duty/fill` - Isi Laporan MOD
- Untuk MOD yang sedang bertugas
- Pilih template yang aktif
- Form dinamis berdasarkan template
- Upload foto dengan compression
- Save as draft atau submit

### `/manager-on-duty/report` - List Laporan MOD
- List semua laporan
- Filter by bulan & status (draft/submitted/reviewed)
- Stats: total, draft, submitted, reviewed
- Tombol detail

### `/manager-on-duty/report/[id]` - Detail Laporan MOD
- View laporan yang di-submit
- View semua field values
- View photos
- Review & approve laporan (HRD/Admin)
- Add review notes

### `/manager-on-duty/dashboard` - Dashboard MOD
- Banner MOD hari ini (kalau Fri/Sat/Sun)
- Tampilkan apakah user sedang MOD
- Quick action: Isi Laporan MOD, Buat WO
- Stats: total jadwal, laporan, submitted, reviewed
- Calendar 7 hari ke depan
- Recent schedules
- Quick links

## Photo Compression
- Max size: 500KB per foto
- Max resolution: 1200px (longest side)
- Quality: 80%
- Format: JPEG

## Components
- `PhotoUpload.tsx` - Upload dengan compression (auto-resize, auto-compress)

## Status Flow
```
Schedule: per tanggal (active)

Report:
  draft → submitted → reviewed
```

## Integration with Work Order
- Dari masalah di MOD, bisa link ke Work Order yang sudah ada via dropdown
- Tabel `work_orders` di Firestore harus sudah ada
- Field `linkedWO?: { id, woNumber, title }` di ProblemFound
- WO yang bisa di-link: semua WO dari collection `work_orders`
- Stats WO dari MOD akan ditambahkan nanti

## Default Template Fields
1. Ringkasan Aktivitas (textarea, required)
2. Item yang Dicek (checkbox, optional)
   - Cek stock bahan baku
   - Inspect area kerja
   - Review absensi staff
   - Cek keamanan
3. Masalah/Issue (textarea, optional)
4. Foto Bukti (photo, optional)
5. Tindak Lanjut (textarea, optional)

## Firestore Security Rules
```javascript
// mod_schedules
match /mod_schedules/{scheduleId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && role in ['super_admin', 'admin', 'hr'];
  allow update: if request.auth != null && role in ['super_admin', 'admin', 'hr'];
  allow delete: if request.auth != null && role == 'super_admin';
}

// mod_templates
match /mod_templates/{templateId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && role in ['super_admin', 'admin', 'hr'];
}

// mod_reports
match /mod_reports/{reportId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null && role == 'super_admin';
}
```