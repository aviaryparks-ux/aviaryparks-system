# AVIARYPARK HR MANAGEMENT SYSTEM
## Dokumen Presentasi untuk Owner

================================================================================
## RINGKASAN EKSEKUTIF
================================================================================

AviaryPark HR Management System adalah sistem HR digital yang komprehensif untuk 
mengelola seluruh aspek sumber daya manusia di AviaryPark.

--------------------------------------------------------------------------------
## MODUL UTAMA SISTEM
--------------------------------------------------------------------------------

1. ABSENSI (Attendance)
2. MANAJEMEN KARYAWAN (Employee Management)
3. SHIFT & JADWAL (Shift Management)
4. KOREKSI ABSENSI (Attendance Corrections)
5. MANAGER ON DUTY (MOD)
6. WORK ORDER
7. EVALUASI KINERJA (Assessment)
8. MORNING BRIEFING
9. APPROVAL FLOW
10. PAYROLL
11. DASHBOARD
12. EVENT MANAGEMENT (FEO & REO)
13. INTERNAL MEMO
14. SALES CALENDAR

================================================================================
## FLOWCHART MODUL 1: ABSENSI (ATTENDANCE)
================================================================================

ALUR ABSENSI KARYAWAN:

    KARYAWAN LOGIN
         |
         v
    +-----------------+
    | CHECK IN PAGI   |
    | - Lokasi (GPS)  |
    | - Foto (kamera) |
    | - Waktu auto    |
    +-----------------+
         |
         v
    +-----------------+
    | CEK SHIFT       |
    | - Jam masuk     |
    | - Toleransi 15m |
    +-----------------+
         |
         | (Tepat waktu)
         | (Terlambat)
         v         v
    [HADIR]    [TERLAMBAT]
         |
         v
    +-----------------+
    | CHECK OUT SORE  |
    | - Lokasi (GPS)  |
    | - Foto (kamera) |
    | - Hitung jam    |
    +-----------------+
         |
         v
    +-----------------+
    | DATA REKAP      |
    | - Hadir         |
    | - Terlambat     |
    | - Alpha         |
    +-----------------+

KEUNTUNGAN:
- Otomatis capture lokasi & waktu
- Tidak bisa manipulasi data
- Monitoring real-time
- Laporan otomatis per bulan/departemen

================================================================================
## FLOWCHART MODUL 2: KOREKSI ABSENSI (ATTENDANCE CORRECTIONS)
================================================================================

ALUR KOREKSI ABSENSI:

    KARYAWAN AJUKAN
    KOREKSI
         |
         v
    +-------------------+
    | Pilih Tanggal &   |
    | Jam Baru          |
    | - Check In baru   |
    | - Check Out baru  |
    | - Alasan          |
    +-------------------+
         |
         v
    +-------------------+
    | SUBMIT REQUEST    |
    | Status: PENDING   |
    +-------------------+
         |
         v
    +-------------------+
    | APPROVAL LEVEL 1  |
    | SPV/Manager Dept |
    | (Cek departemen)  |
    +-------------------+
         | Approved       | Rejected
         v                v
    +-------------------+    +-------------------+
    | APPROVAL LEVEL 2  |    | NOTIF KARYAWAN    |
    | HR               |    | "Ditolak"         |
    +-------------------+    +-------------------+
         |
         | Approved
         v
    +-------------------+
    | KOREKSI BERHASIL |
    | Data diperbarui   |
    +-------------------+

KEUNTUNGAN:
- Tidak perlu ke HR secara fisik
- Trackable & transparan
- Approval sesuai level
- History tersimpan

================================================================================
## FLOWCHART MODUL 3: MANAGER ON DUTY (MOD)
================================================================================

MOD SYSTEM - Jumat, Sabtu, Minggu:

    +-------------------+
    | ATUR JADWAL MOD  |
    | HR/Admin Buat    |
    +-------------------+
         |
         v
    +-------------------+
    | JADWAL PER TANGGAL |
    | Jumat = Manager    |
    | Sabtu = SPV Sales  |
    | Minggu = SPV Sales |
    +-------------------+
         |
         v
    +-------------------+
    | MOD BERTUGAS      |
    | Jumat-Sabtu-Minggu|
    +-------------------+
         |
         v
    +-------------------+
    | ISI LAPORAN MOD   |
    | - Checklist area  |
    | - Upload foto     |
    | - Catat masalah   |
    +-------------------+
         |
         v
    +-------------------+
    | KIRIM KE HR       |
    | Status: Submitted  |
    +-------------------+
         |
         v
    +-------------------+
    | REVIEW HR         |
    | Approved           |
    +-------------------+

AREA CEK MOD:
1. Front Office
2. Housekeeping
3. Public Area
4. Kitchen & Restaurant
5. Security & Safety

KEUNTUNGAN:
- Kualitas layanan terjaga
- Tanggung jawab jelas
- Dokumentasi otomatis
- Masalah cepat terdeteksi

================================================================================
## FLOWCHART MODUL 4: WORK ORDER
================================================================================

DUA TIPE WORK ORDER:

URGENT WORK ORDER:
==================

    +-------------------+
    | BUAT WO URGENT    |
    | - Title & Deskripsi|
    | - Prioritas: High  |
    | - Dept tujuan     |
    +-------------------+
         |
         v
    +-------------------+
    | SET SLA           |
    | - Due Date        |
    | - Due Time        |
    | - SLA Hours       |
    +-------------------+
         |
         v
    +-------------------+
    | ASSIGN TO         |
    | Dept/User         |
    +-------------------+
         |
         v
    +-------------------+
    | STATUS FLOW       |
    | Open -> In Progress -> Completed |
    +-------------------+


PROJECT WORK ORDER:
===================

    +-------------------+
    | BUAT WO PROJECT   |
    | - Title & Deskripsi|
    | - Milestones      |
    | - Budget          |
    +-------------------+
         |
         v
    +-------------------+
    | SET MILESTONES    |
    | - Milestone 1     |
    | - Milestone 2     |
    | - Milestone N     |
    +-------------------+
         |
         v
    +-------------------+
    | SET BUDGET        |
    | - Item budget     |
    | - Estimated cost  |
    +-------------------+
         |
         v
    +-------------------+
    | APPROVAL CHAIN    |
    | SPV -> Manager -> HR |
    +-------------------+
         |
         v
    +-------------------+
    | STATUS FLOW       |
    | Open -> In Progress -> Pending Approval -> Completed |
    +-------------------+

KEUNTUNGAN:
- Task tracking jelas
- SLA monitoring otomatis
- Budget tracking project
- Collaboration via chat

================================================================================
## FLOWCHART MODUL 5: EVALUASI KINERJA (ASSESSMENT)
================================================================================

    +-------------------+
    | ATUR PERIODE      |
    | HR buat periode   |
    | penilaian         |
    +-------------------+
         |
         v
    +-------------------+
    | ATUR ASPEK        |
    | PENILAIAN         |
    | - Kompetensi      |
    | - Bobot setiap    |
    |   aspek           |
    +-------------------+
         |
         v
    +-------------------+
    | SELF ASSESSMENT   |
    | Karyawan isi      |
    | penilaian diri    |
    +-------------------+
         |
         v
    +-------------------+
    | MANAGER           |
    | ASSESSMENT        |
    | Manager nilai     |
    | karyawannya       |
    +-------------------+
         |
         v
    +-------------------+
    | HITUNG SKOR       |
    | Total = Σ(Skor x |
    | Bobot)            |
    +-------------------+
         |
         v
    +-------------------+
    | RATING            |
    | 90-100: Sangat Baik|
    | 75-89: Baik       |
    | 60-74: Cukup      |
    | 50-59: Kurang     |
    | <50: Sangat Kurang|
    +-------------------+

KEUNTUNGAN:
- Objektif & terukur
- Data untuk keputusan
- Motivasi karyawan
- Tracking improvement

================================================================================
## FLOWCHART MODUL 6: MORNING BRIEFING (AI)
================================================================================

    +-------------------+
    | REKAM MEETING     |
    | Voice Recorder    |
    | Real-time         |
    | Transcription      |
    +-------------------+
         |
         v
    +-------------------+
    | AI PROCESSING     |
    | - Extract Actions |
    | - Extract Decisons|
    | - Extract Schedules|
    | - Extract Issues   |
    +-------------------+
         |
         v
    +-------------------+
    | GENERATE RESULT   |
    | - Executive       |
    |   Summary         |
    | - Action Items    |
    | - Decisions       |
    | - Schedules       |
    | - Issues          |
    +-------------------+
         |
         v
    +-------------------+
    | SIMPAN & SHARE    |
    | - Firestore       |
    | - Copy to clip    |
    | - History meeting |
    +-------------------+

KEUNTUNGAN:
- Tidak perlu notulensi manual
- AI extract poin penting
- T.trackable decisions
- Efficient meeting

================================================================================
## FLOWCHART MODUL 7: EVENT MANAGEMENT (FEO & REO)
================================================================================

FEO = Fieldtrip Event Order (Rombongan Sekolah/Lembaga)
REO = Regional Event Order (Event/Open Trip/Group Booking)

FEO FLOW:
=========

    +-------------------+
    | CLIENT INQUIRY    |
    | - Nama Sekolah     |
    | - Tanggal Kunj.   |
    | - Jumlah Peserta   |
    +-------------------+
         |
         v
    +-------------------+
    | SALES INPUT FEO    |
    | - Pilih Klien     |
    | - Detail Event    |
    | - Paket & Harga   |
    | - Estimasi Budget |
    +-------------------+
         |
         v
    +-------------------+
    | SET APPROVERS     |
    | (Custom per FEO)  |
    | SPV -> Manager    |
    +-------------------+
         |
         v
    +-------------------+
    | APPROVAL CHAIN    |
    | Status: Waiting   |
    +-------------------+
         | Approved by All
         v
    +-------------------+
    | FEO APPROVED      |
    | Status: Approved  |
    +-------------------+
         |
         v
    +-------------------+
    | EVENT EXECUTION    |
    | Status: Ongoing   |
    +-------------------+
         |
         v
    +-------------------+
    | EVENT COMPLETED   |
    | Status: Done      |
    +-------------------+

REO FLOW:
=========

    +-------------------+
    | CLIENT INQUIRY    |
    | - Event Type      |
    | - Tanggal Event   |
    | - Expected Guest  |
    +-------------------+
         |
         v
    +-------------------+
    | SALES INPUT REO   |
    | - Pilih Klien    |
    | - Detail Event   |
    | - Paket & Harga  |
    | - Down Payment   |
    +-------------------+
         |
         v
    +-------------------+
    | NEGOTIATION       |
    | (Optional)        |
    | Nego harga/paket |
    +-------------------+
         |
         v
    +-------------------+
    | APPROVAL CHAIN    |
    | Status: Waiting   |
    +-------------------+
         | Approved by All
         v
    +-------------------+
    | REO APPROVED      |
    | Status: Approved  |
    +-------------------+
         |
         v
    +-------------------+
    | EVENT EXECUTION   |
    | Status: Ongoing   |
    +-------------------+
         |
         v
    +-------------------+
    | EVENT COMPLETED   |
    | Status: Done      |
    +-------------------+

EVENT STATUS FLOW:
==================
DRAFT -> WAITING_APPROVAL -> APPROVED/NEGOTIATION -> ONGOING -> DONE
                                              |                    |
                                              +-- REJECTED -------+-- CANCELLED

SALES CALENDAR:
==============
- Kalender visual semua event FEO & REO
- Filter per bulan/tahun
- Tampilkan status event
- Leaderboard sales

KEUNTUNGAN:
- Tracking event terintegrasi
- Approval system fleksibel
- Visual calendar
- Sales performance tracking

================================================================================
## FLOWCHART MODUL 8: INTERNAL MEMO
================================================================================

ALUR INTERNAL MEMO:

    +-------------------+
    | BUAT MEMO BARU    |
    | HR/Admin/Manager  |
    | - Judul Memo      |
    | - Isi/Pesan      |
    | - Target Dept    |
    +-------------------+
         |
         v
    +-------------------+
    | SET APPROVERS     |
    | (Custom per Memo) |
    | Level 1: SPV     |
    | Level 2: Manager |
    | Level 3: GM      |
    +-------------------+
         |
         v
    +-------------------+
    | SUBMIT MEMO       |
    | Status: PENDING  |
    +-------------------+
         |
         v
    +-------------------+
    | APPROVAL LEVEL 1  |
    | Approver 1 Review |
    +-------------------+
         | Approved       | Rejected
         v                v
    +-------------------+    +-------------------+
    | APPROVAL LEVEL 2  |    | NOTIF PEMBUAT    |
    | Approver 2 Review |    | "Ditolak"        |
    +-------------------+    +-------------------+
         |
         | Approved
         v
    +-------------------+
    | MEMO APPROVED     |
    | Status: APPROVED  |
    | Broadcast ke     |
    | dept terkait     |
    +-------------------+

MEMO TYPES:
===========
- Pemberitahuan Umum
- Kebijakan Baru
- Perubahan Aturan
- Undangan Meeting
- Instruksi Kerja

KEUNTUNGAN:
- Komunikasi formal terdokumentasi
- Approval tracking
- Broadcast ke dept terkait
- History memo tersimpan

================================================================================
## FLOWCHART MODUL 9: APPROVAL FLOW (KONFIGURABEL)
================================================================================

    +-------------------+
    | SETUP APPROVAL    |
    | FLOW PER DEPT     |
    | HR/Admin Konfigurasi|
    +-------------------+
         |
         v
    +-------------------+
    | PILIH ROLE        |
    | LEVEL APPROVAL    |
    |                   |
    | ┌─────────────┐   |
    | │ Level 1: SPV │   |
    | │ Level 2: Mgr │   |
    | │ Level 3: HR  │   |
    | │ Level N: ... │   |
    | └─────────────┘   |
    +-------------------+
         |
         v
    +-------------------+
    | ACTIVATE PER      |
    | DEPARTMENT        |
    | Dept A: SPV->HR   |
    | Dept B: Mgr->GM  |
    +-------------------+

Contoh Flow:
IT Department: SPV -> Manager -> HR
Sales Department: SPV -> Manager -> GM -> HR
Finance Department: Manager -> GM -> Owner -> HR

KEUNTUNGAN:
- Fleksibel sesuai kebutuhan
- Clear authority
- Audit trail
- No bottleneck

================================================================================
## USER ROLES & PERMISSIONS
================================================================================

| Role       | Dashboard | Attendance | Employee | Approval | MOD   | WO    | Event | Memo |
|------------|-----------|------------|----------|----------|-------|-------|-------|------|
| Super Admin| Full      | Full       | Full     | Full     | Full  | Full  | Full  | Full |
| Admin      | Full      | Full       | Full     | Full     | Full  | Full  | Full  | Full |
| HR         | Full      | Full       | Full     | Full     | Full  | Full  | Full  | Full |
| GM         | Dept Only | View       | View     | Dept Only| View  | Dept  | View  | View |
| Manager    | Dept Only | View       | View     | Dept Only| View  | Dept  | View  | View |
| SPV        | Dept Only | View       | View     | Dept Only| View  | Dept  | View  | View |
| Employee   | Self      | Self       | Self     | -        | -     | Self  | -     | -    |

================================================================================
## KEUNTUNGAN KESELURUHAN SISTEM
================================================================================

1. EFISIENSI WAKTU
   - Otomasi proses manual
   - Tidak perlu formulir kertas
   - Approval cepat via sistem

2. AKURASI DATA
   - GPS & foto timestamp
   - Tidak ada manipulasi
   - Backup otomatis di cloud

3. TRANSPARANSI
   - Semua pihak bisa track
   - History lengkap
   - Clear responsibility

4. REPORTING
   - Dashboard real-time
   - Export Excel/PDF
   - Analisis tren

5. KEAMANAN
   - Role-based access
   - Data terenkripsi
   - Audit log

6. SCALABILITY
   - Cloud-based (Firebase)
   - Bisa diakses dimana saja
   - User unlimited

================================================================================
## DAFTAR FITUR UTAMA
================================================================================

ABSENSI:
- Check in/out dengan GPS
- Camera capture
- Shift management
- Late tolerance setting
- Work from home support

EMPLOYEE:
- CRUD employee
- Import/Export Excel
- Department management
- Role assignment
- Bank details

WORK ORDER:
- Urgent WO dengan SLA
- Project WO dengan Milestone
- Budget tracking
- Chat/thread
- Photo documentation

ASSESSMENT:
- Configurable aspects
- Self assessment
- Manager assessment
- Period management
- Rating system

MORNING BRIEFING:
- Voice recording
- AI transcription
- Action items extract
- Meeting history
- Share result

MOD:
- Schedule MOD
- Daily checklist
- Photo evidence
- Problem reporting
- Link to WO

PAYROLL:
- Salary calculation
- Attendance integration
- Bank transfer data
- Reports

EVENT MANAGEMENT (FEO & REO):
- Create & manage FEO (Fieldtrip)
- Create & manage REO (Regional Event)
- Custom approval flow per event
- Client management
- Sales calendar view
- Sales leaderboard

INTERNAL MEMO:
- Create memo dengan approval
- Broadcast ke dept terkait
- Approval chain tracking
- Status: Draft -> Pending -> Approved/Rejected

================================================================================
## KESIMPULAN
================================================================================

AviaryPark HR Management System memberikan solusi lengkap untuk mengelola
sumber daya manusia secara digital, efisien, dan transparan.

DENGAN SISTEM INI:
- HR bisa bekerja 80% lebih efisien
- Approval jadi lebih cepat
- Data akurat dan real-time
- Laporan selalu siap
- Kepuasan karyawan meningkat

================================================================================
