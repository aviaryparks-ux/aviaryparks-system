export type EventType = "REO" | "FEO";
export type EventStatus = "draft" | "approved" | "ongoing" | "done" | "cancelled" | "rejected" | "negotiation" | "waiting_approval";

export interface BaseEvent {
  id?: string;
  documentNumber?: number;
  title: string;
  clientName: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  startTime?: string; // Format HH:mm
  endTime?: string; // Format HH:mm
  restaurantName?: string; // Pulled to root for clash check (HWAMEI / VULTURE'S NEST)
  venueSection?: string; // Pulled to root for clash check (Section A, B, C...)
  type: EventType;
  status: EventStatus;
  createdAt?: any; // Firestore timestamp
  createdBy?: string; // UID
  createdByName?: string; // Name of creator
  creatorSignatureUrl?: string; // Signature of creator
  updatedAt?: any; // Firestore timestamp
  
  // Approval Flow
  approvalFlow?: {
    approverUid: string;
    approverName: string;
    approverRole: string;
    actionType: string; // "Mengetahui" | "Menyetujui"
    status: "WAITING" | "APPROVED" | "REJECTED";
    signatureUrl: string | null;
    approvedAt: any | null;
    note?: string;
  }[];
  currentApproverIndex?: number;
}

export interface REOData {
  // General Info
  guestName: string;
  companyName: string;
  address: string;
  venueSection: string;
  eventType: string; // e.g., Social Event
  typeOfEvent: string; // e.g., Birthday
  timeOfEvent: string;
  setupLayout: string;
  pax: number;
  package: string;
  price: number;
  corkage: string;
  equipmentNeeded: string;
  salesIncharge: string;
  fbIncharge: string;
  remarks: string;
  restaurantName: string; // "HWAMEI" or "VULTURE'S NEST"

  // Detail Price (Table)
  priceDetails: {
    packageName: string;
    pax: number;
    price: number;
    total: number;
  }[];
  grandTotal: number;
  downPayment: number;
  balancePayment: number;

  // Kitchen / Food Arrangements
  buffetReadyJam: string;
  overHandle: string;
  appetizer: string;
  soup: string;
  mainCourse: string;
  sideDish: string;
  dessert: string;
  beverage: string;

  // Department Arrangements
  restaurantArrangement: string; // was hwameiArrangement
  billingInstruction: string;
  engineering: string;
  finance: string;
  it: string;
  security: string;
  housekeeping: string;
  salesMarketing: string;
  otherDepartment: string;

  // Signatures
  preparedBy: string;
  approvedBy: string;
}

export interface FEOData {
  // General Info
  schoolName: string;
  personIncharge: string;
  salesIncharge: string;
  address: string;
  mobileNo: string;
  remarks: string;
  restaurantName: string; // Used for clash check

  // Pax Details
  paxTotal: number;
  paxKids: number;
  paxTeacher: number;
  paxParent: number;
  paxComplimentary: number;

  // Merch
  bucketHatCount: number;
  souvenirCount: number;

  // Price Details
  priceDetails: {
    packageName: string;
    pax: number;
    price: number;
    total: number;
  }[];
  additionalChargeName: string;
  additionalChargePax: number;
  additionalChargePrice: number;
  additionalChargeTotal: number;
  grandTotal: number;
  downPayment: number;
  balancePayment: number;

  // Rundown & Meal Box
  zonaMorningTour: string;
  lunchArea: string;
  mealBoxKids: string;
  mealBoxKidsPax: number;
  mealBoxTeacher: string;
  mealBoxTeacherPax: number;
  driver: string;

  // Department Notes
  notesCurator: string;
  notesTicketing: string;
  notesFBKitchen: string;
  notesFBService: string;
  notesHousekeeping: string;
  notesSecurity: string;
  notesSalesMarketing: string;

  // Signatures
  preparedBy: string;
  checkedBy: string; // Legacy string, actual signature in approvalFlow
}

export interface AppEvent extends BaseEvent {
  reoData?: REOData;
  feoData?: FEOData;
}
