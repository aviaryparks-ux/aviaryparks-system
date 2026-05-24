// types/mod.ts - TypeScript types for Manager on Duty

export interface MODQuestion {
  text: string;
  needPhoto: boolean;
  needNote: boolean;
  actionRequired: boolean;
}

export interface MODArea {
  name: string;
  order: number;
  questions: MODQuestion[];
}

export type PhotoRating = "pass" | "need_improvement";

export interface QuestionPhoto {
  id: string;
  url: string;
  caption: string;
  rating: PhotoRating | null;
}

export interface MODSchedule {
  id: string;
  date: string; // Format: YYYY-MM-DD (per tanggal)
  dayOfWeek: 'friday' | 'saturday' | 'sunday';
  userId: string;
  userName: string;
  department: string;
  role: string; // 'manager' atau 'spv'
  notes: string;
  createdAt: any;
  createdBy: string;
  createdByName: string;
  createdByEmail?: string;
  updatedAt: any;
  updatedBy: string;
  updatedByName: string;
}

export interface MODTemplate {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  areas: MODArea[];
  createdBy: string;
  createdByName: string;
  createdAt: any;
  updatedAt: any;
}

// Default template structure
export const defaultMODTemplate: Omit<MODTemplate, 'id' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'> & { id?: string } = {
  id: 'daily_checklist',
  name: 'Daily MOD Inspection Checklist',
  description: 'Template checklist inspeksi MOD harian',
  isActive: true,
  areas: [
    {
      name: 'Front Office',
      order: 1,
      questions: [
        { text: 'Lobby bersih dan rapi', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Resepsionis hadir dan siap', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Counter resepsionis bersih', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'AC menyala dan suhu normal', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Billboard/pengumuman terbaru', needPhoto: false, needNote: false, actionRequired: false },
      ]
    },
    {
      name: 'Housekeeping',
      order: 2,
      questions: [
        { text: 'Kamar tamu bersih', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Kasur rapih dan sprei diganti', needPhoto: true, needNote: true, actionRequired: false },
        { text: 'Kamar mandi bersih dan tidak berbau', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Amenities lengkap', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Lampu kamar semua menyala', needPhoto: false, needNote: true, actionRequired: true },
      ]
    },
    {
      name: 'Public Area',
      order: 3,
      questions: [
        { text: 'Kolam renang bersih', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Gym bersih dan alat lengkap', needPhoto: false, needNote: true, actionRequired: true },
        { text: 'Toilet publik bersih', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Taman terawat', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Parkiran bersih dan terstruktur', needPhoto: false, needNote: true, actionRequired: false },
      ]
    },
    {
      name: 'Kitchen & Restaurant',
      order: 4,
      questions: [
        { text: 'Dapur bersih dan hygienic', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Makanan fresh dan tidak expired', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Peralatan masak terawat', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Meja makan rapih', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Suplai air dan beverage tercukupi', needPhoto: false, needNote: true, actionRequired: false },
      ]
    },
    {
      name: 'Security & Safety',
      order: 5,
      questions: [
        { text: 'CCTV berfungsi normal', needPhoto: false, needNote: true, actionRequired: true },
        { text: 'Pos security terjaga', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Fire extinguisher tidak expired', needPhoto: true, needNote: true, actionRequired: true },
        { text: 'Jalur evakuasi bersih', needPhoto: false, needNote: true, actionRequired: false },
        { text: 'Pencahayaan area aman cukup', needPhoto: false, needNote: true, actionRequired: true },
      ]
    },
  ]
};

// Helper to get day name
export const getDayName = (day: 'friday' | 'saturday' | 'sunday'): string => {
  const names: Record<string, string> = {
    friday: 'Jumat',
    saturday: 'Sabtu',
    sunday: 'Minggu'
  };
  return names[day] || day;
};

// Get day of week from date string
export const getDayOfWeek = (dateStr: string): 'friday' | 'saturday' | 'sunday' | null => {
  const date = new Date(dateStr);
  const day = date.getDay();
  if (day === 5) return 'friday';   // Jumat
  if (day === 6) return 'saturday'; // Sabtu
  if (day === 0) return 'sunday';   // Minggu
  return null;
};

// Format date for display
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Format date short
export const formatDateShort = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short'
  });
};

// Get label based on role
export const getRoleLabel = (role: string): string => {
  if (role === 'manager') return 'Manager';
  if (role === 'spv') return 'SPV Sales';
  if (role === 'user') return 'User/Staff';
  return role;
};