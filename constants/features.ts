// constants/features.ts

export interface AppFeature {
  id: string;
  name: string;
  description: string;
  module: string;
}

export const APP_FEATURES: AppFeature[] = [
  // Dashboard & General
  { id: "view_dashboard", name: "Lihat Dashboard", description: "Akses halaman dashboard utama", module: "General" },
  { id: "manage_settings", name: "Kelola Pengaturan", description: "Akses ke halaman pengaturan aplikasi", module: "General" },
  
  // Users
  { id: "manage_users", name: "Kelola Karyawan", description: "Tambah, edit, hapus data karyawan", module: "User Management" },
  { id: "view_users", name: "Lihat Karyawan", description: "Melihat direktori karyawan", module: "User Management" },
  
  // Absensi & Shift
  { id: "view_attendance", name: "Lihat Absensi", description: "Melihat laporan dan data absensi", module: "Attendance & Shift" },
  { id: "manage_attendance", name: "Kelola Absensi", description: "Menyetujui/menolak permintaan absensi", module: "Attendance & Shift" },
  { id: "view_shifts", name: "Lihat Shift", description: "Melihat jadwal shift", module: "Attendance & Shift" },
  { id: "manage_shifts", name: "Kelola Shift", description: "Membuat dan mengubah jadwal shift", module: "Attendance & Shift" },

  // Location Tracking
  { id: "view_locations", name: "Lihat Lokasi GPS", description: "Melacak lokasi live karyawan", module: "Location Tracking" },

  // Work Orders
  { id: "view_work_orders", name: "Lihat Work Orders", description: "Melihat daftar Work Order", module: "Work Orders" },
  { id: "create_work_order", name: "Buat Work Order", description: "Membuat Work Order baru", module: "Work Orders" },
  { id: "manage_work_orders", name: "Kelola Work Orders", description: "Mengubah status, assign, dan edit Work Order", module: "Work Orders" },
  { id: "manage_wo_templates", name: "Template Work Order", description: "Mengatur Area dan Inventory Work Order", module: "Work Orders" },

  // INTERNAL MEMO MODULE
  {
    id: "view_memo",
    name: "Lihat Internal Memo",
    description: "Melihat daftar dan detail Internal Memo.",
    module: "MEMO MODULE",
  },
  {
    id: "manage_memo",
    name: "Kelola Internal Memo",
    description: "Membuat, mengedit, dan menghapus Internal Memo.",
    module: "MEMO MODULE",
  },
  {
    id: "approve_memo",
    name: "Setujui Internal Memo",
    description: "Membubuhkan tanda tangan untuk menyetujui Memo.",
    module: "MEMO MODULE",
  },

  // Manager on Duty
  { id: "view_mod", name: "Lihat Laporan MOD", description: "Melihat laporan Manager on Duty", module: "Manager On Duty" },
  { id: "fill_mod", name: "Isi Laporan MOD", description: "Mengisi checklist laporan MOD", module: "Manager On Duty" },
  { id: "manage_mod_schedule", name: "Kelola Jadwal MOD", description: "Mengatur jadwal piket MOD", module: "Manager On Duty" },
  { id: "manage_mod_templates", name: "Template Laporan MOD", description: "Mengatur template form checklist MOD", module: "Manager On Duty" },

  // Assessment & KPI
  { id: "view_assessments", name: "Lihat Penilaian", description: "Melihat hasil penilaian karyawan", module: "Assessment & KPI" },
  { id: "manage_assessments", name: "Kelola Penilaian", description: "Membuat periode dan memberikan penilaian", module: "Assessment & KPI" },
  
  // Payroll
  { id: "view_payroll", name: "Lihat Payroll", description: "Melihat data gaji dan slip", module: "Payroll" },
  { id: "manage_payroll", name: "Kelola Payroll", description: "Generate slip gaji dan pembayaran", module: "Payroll" },

  // Briefing & Meeting
  { id: "view_meetings", name: "Lihat Meeting/Briefing", description: "Melihat jadwal dan notulensi", module: "Communication" },
  { id: "manage_meetings", name: "Kelola Meeting/Briefing", description: "Membuat jadwal meeting dan notulensi", module: "Communication" },
  
  // Articles
  { id: "manage_articles", name: "Kelola Pengumuman", description: "Membuat dan mengedit artikel/pengumuman", module: "Communication" },

  // Roles & Settings (Additional)
  { id: "manage_roles", name: "Kelola Pengaturan Peran", description: "Mengatur hak akses fitur untuk setiap peran", module: "General" },

  // Events
  { id: "view_events_dashboard", name: "Lihat Dashboard Event", description: "Melihat ringkasan event FEO & REO", module: "Events" },
  { id: "view_clients", name: "Lihat Database Klien", description: "Melihat daftar klien event", module: "Events" },
  { id: "view_calendar", name: "Lihat Kalender Event", description: "Melihat jadwal event di kalender bulanan", module: "Events" },
  { id: "view_feo", name: "Lihat FEO", description: "Melihat daftar dan detail FEO", module: "Events" },
  { id: "manage_feo", name: "Kelola FEO", description: "Membuat, mengedit, menghapus, dan menyetujui FEO", module: "Events" },
  { id: "view_reo", name: "Lihat REO", description: "Melihat daftar dan detail REO", module: "Events" },
  { id: "manage_reo", name: "Kelola REO", description: "Membuat, mengedit, menghapus, dan menyetujui REO", module: "Events" }
];

export const AVAILABLE_ROLES = [
  { id: "owner", name: "Owner / Direktur" },
  { id: "gm", name: "General Manager (GM)" },
  { id: "super_admin", name: "Super Admin (Mutlak)" },
  { id: "hod", name: "Head of Department (HOD)" },
  { id: "manager", name: "Manager" },
  { id: "admin", name: "Admin" },
  { id: "hr", name: "Human Resources (HR)" },
  { id: "spv", name: "Supervisor (SPV)" },
  { id: "staff", name: "Staff / User Biasa" }
];
