// types/work-order.ts - TypeScript types for Work Order

// --- NEW INVENTORY TEMPLATE TYPES ---
export interface WOInventoryItem {
  id: string;
  name: string;
}

export interface WOArea {
  id: string;
  name: string;
  items: WOInventoryItem[];
}

export interface WOInventoryTemplate {
  id: string;
  name: string;
  areas: WOArea[];
  updatedAt?: any;
  updatedBy?: string;
}
// ------------------------------------

export type WorkOrderType = "urgent" | "project";

export type WorkOrderStatus =
  | "open"
  | "in_progress"
  | "pending_approval"
  | "completed"
  | "cancelled";

export type WorkOrderPriority = "low" | "medium" | "high" | "critical";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface WorkOrderPhoto {
  id: string;
  url: string;
  caption: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: any;
}

// For Urgent WO - SLA tracking
export interface SLATracking {
  dueDate: string; // ISO date
  dueTime: string; // HH:mm
  slaHours: number;
  isOverdue: boolean;
  completedAt?: any;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: any;
}

// For Project WO - Milestones
export interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO date
  status: "pending" | "in_progress" | "completed";
  completedAt?: any;
  completedBy?: string;
  completedByName?: string;
}

// For Project WO - Budget tracking
export interface BudgetItem {
  id: string;
  description: string;
  category: string;
  estimatedCost: number;
  actualCost: number;
  receiptUrl?: string;
}

export interface ApprovalStep {
  id: string;
  step: number;
  role: string;
  approverId?: string;
  approverName?: string;
  status: ApprovalStatus;
  notes?: string;
  actionAt?: any;
}

// Main Work Order interface
export interface WorkOrder {
  id: string;
  woNumber: string;
  title: string;
  description: string;
  type: WorkOrderType;

  // Status & Priority
  status: WorkOrderStatus;
  priority: WorkOrderPriority;

  // Assignment
  createdBy: string;
  createdByName: string;
  createdByDept: string;
  createdAt: any;

  assignedToDept: string;
  assignedToDivision?: string;
  assignedToUser?: string;
  assignedToUserName?: string;

  // Area & Inventory (Optional)
  locationArea?: string;
  inventoryItem?: string;

  // Type-specific fields
  sla?: SLATracking;
  milestones?: Milestone[];
  budget?: BudgetItem[];
  estimatedBudget?: number;
  actualBudget?: number;

  // Photos
  photos: WorkOrderPhoto[];

  // Notes/Updates
  notes: string;
  updateHistory: WorkUpdate[];

  // Approval chain (for Project WO)
  approvalSteps: ApprovalStep[];
  currentApprovalStep: number;

  // MOD link (if created from MOD)
  source?: "mod";
  sourceReportId?: string;
  sourceProblemId?: string;

  // Tags
  tags: string[];

  // Completion
  completedAt?: any;
  completedBy?: string;
  completedByName?: string;
  completionNotes?: string;

  updatedAt: any;
  updatedBy: string;
  updatedByName: string;
}

export interface WorkUpdate {
  id: string;
  text: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: any;
}

// Thread/Chat for Work Order discussion
export interface WorkThread {
  id: string;
  woId: string;
  messages: ThreadMessage[];
  lastMessageAt: any;
}

export interface ThreadMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  attachments: WorkOrderPhoto[];
  createdAt: any;
  isSystemMessage: boolean;
}

// Generate WO number
export const generateWONumber = (type: WorkOrderType, dept: string): string => {
  const prefix = type === "urgent" ? "WO-URG" : "WO-PROJ";
  const deptCode = dept.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${deptCode}-${timestamp}`;
};

// Get status color
export const getWOStatusColor = (status: WorkOrderStatus): string => {
  const colors: Record<WorkOrderStatus, string> = {
    open: "bg-red-100 text-red-600",
    in_progress: "bg-yellow-100 text-yellow-600",
    pending_approval: "bg-blue-100 text-blue-600",
    completed: "bg-green-100 text-green-600",
    cancelled: "bg-gray-100 text-gray-600"
  };
  return colors[status] || "bg-gray-100 text-gray-600";
};

// Get status label
export const getWOStatusLabel = (status: WorkOrderStatus): string => {
  const labels: Record<WorkOrderStatus, string> = {
    open: "Buka",
    in_progress: "Sedang Dikerjakan",
    pending_approval: "Menunggu Persetujuan",
    completed: "Selesai",
    cancelled: "Dibatalkan"
  };
  return labels[status] || status;
};

// Get priority color
export const getWOPriorityColor = (priority: WorkOrderPriority): string => {
  const colors: Record<WorkOrderPriority, string> = {
    low: "bg-gray-100 text-gray-600",
    medium: "bg-yellow-100 text-yellow-600",
    high: "bg-orange-100 text-orange-600",
    critical: "bg-red-100 text-red-600"
  };
  return colors[priority] || "bg-gray-100 text-gray-600";
};

// Get priority label
export const getWOPriorityLabel = (priority: WorkOrderPriority): string => {
  const labels: Record<WorkOrderPriority, string> = {
    low: "Rendah",
    medium: "Sedang",
    high: "Tinggi",
    critical: "Kritis"
  };
  return labels[priority] || priority;
};

// Default approval steps for Project WO
// Flow: Dept Manager → Finance
export const defaultApprovalSteps = (): ApprovalStep[] => [
  { id: "step-1", step: 1, role: "dept_manager", status: "pending" },
  { id: "step-2", step: 2, role: "finance", status: "pending" }
];