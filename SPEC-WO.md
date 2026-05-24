# SPEC: Work Order (WO)

## Overview
Sistem Work Order untuk mengelola task/tugas di AviaryPark HR Management. Ada 2 tipe: Urgent (dengan SLA) dan Project (dengan budget & milestones).

## Work Order Types

### 1. Urgent Work Order
- Task yang perlu diselesaikan segera
- **SLA tracking**: due date + due time, auto-overdue detection
- Single assignment
- Approval tidak perlu (langsung dikerjakan)
- Status flow: `open` → `in_progress` → `completed`

### 2. Project Work Order
- Project besar dengan milestone dan budget
- **Budget tracking**: estimated vs actual per item
- **Milestones**: bertahap per fase
- **Approval chain**: Dept Manager → Finance (sequential)
- Status flow: `open` → `in_progress` → `pending_approval` → `completed`

## User Roles & Permissions
| Role | Create WO | View WO | Edit WO | Delete WO | Approve WO |
|------|-----------|---------|---------|-----------|------------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ❌ | ✅ |
| HR | ✅ | ✅ | ✅ | ❌ | ✅ |
| SPV | ✅ | ✅ | Own WO | ❌ | Own step |
| Manager | ✅ | ✅ | Own WO | ❌ | Own step |
| Employee | ❌ | Own WO | ❌ | ❌ | ❌ |

## Firestore Collections

### `work_orders`
```typescript
{
  id: string,
  woNumber: string,           // Format: WO-URG-{DEPT}-{ID} atau WO-PROJ-{DEPT}-{ID}
  title: string,
  description: string,
  type: "urgent" | "project",

  // Status & Priority
  status: "open" | "in_progress" | "pending_approval" | "completed" | "cancelled",
  priority: "low" | "medium" | "high" | "critical",

  // Creator
  createdBy: string,
  createdByName: string,
  createdByDept: string,
  createdAt: timestamp,

  // Assignment
  assignedToDept: string,
  assignedToUser?: string,
  assignedToUserName?: string,

  // SLA (Urgent WO)
  sla?: {
    dueDate: string,           // YYYY-MM-DD
    dueTime: string,           // HH:mm
    slaHours: number,
    isOverdue: boolean,
    completedAt?: timestamp,
    acknowledgedBy?: string,
    acknowledgedByName?: string,
    acknowledgedAt?: timestamp
  },

  // Milestones (Project WO)
  milestones?: Milestone[],
  // Budget (Project WO)
  budget?: BudgetItem[],
  estimatedBudget?: number,
  actualBudget?: number,

  // Photos
  photos: WorkOrderPhoto[],

  // Notes
  notes: string,
  updateHistory: WorkUpdate[],

  // Approval chain (Project WO)
  approvalSteps: ApprovalStep[],
  currentApprovalStep: number,

  // MOD link
  source?: "mod",
  sourceReportId?: string,
  sourceProblemId?: string,

  // Tags
  tags: string[],

  // Completion
  completedAt?: timestamp,
  completedBy?: string,
  completedByName?: string,
  completionNotes?: string,

  updatedAt: timestamp,
  updatedBy: string,
  updatedByName: string
}
```

### `work_threads`
```typescript
{
  id: string,
  woId: string,
  messages: ThreadMessage[],
  lastMessageAt: timestamp
}
```

## Pages

### `/work-orders` - List Work Orders
- Filter by: type, status, department, priority
- Sort by: date, priority, status
- Stats: total, open, in_progress, completed
- Quick create button
- Link to MOD source if any

### `/work-orders/create` - Create Work Order
- Choose type: Urgent atau Project
- Form fields based on type
- For Urgent: title, description, priority, dept, due date/time, assignee
- For Project: title, description, priority, dept, estimated budget, milestones
- Photos upload (compressed)
- Submit creates WO in Firestore

### `/work-orders/[id]` - Detail Work Order
- View all WO details
- Timeline/status progress
- For Urgent: SLA countdown timer
- For Project: Milestones checklist, Budget progress
- Thread/Chat section for discussion
- Photo gallery
- Update status (if permitted)
- Approval actions (for Project WO)

### `/work-orders/[id]/edit` - Edit Work Order
- Same as create but pre-filled
- Only owner or admin can edit
- Cannot edit if status is `completed`

## Thread/Chat System
- Every WO has a thread
- Messages can include text + photos
- System messages for status changes
- Real-time updates (onSnapshot)
- Basic UI: input box + send button

## SLA Tracking (Urgent WO)
- Display countdown: "Due in X hours Y minutes"
- Visual indicator: green → yellow → red as deadline approaches
- Auto-mark as overdue when past due time
- Alert banner for overdue items

## Budget & Milestones (Project WO)
- Budget: list of items with estimated vs actual cost
- Progress bar: spent/estimated
- Milestones: ordered list with due dates
- Mark milestone complete with timestamp

## Approval Chain (Project WO)
- Sequential: SPV → Manager → HR
- Each approver sees their pending items
- Approve/Reject with notes
- Rejected → back to draft (creator can fix & resubmit)
- Approved by all → status changes to pending_approval → ready for work

## Photo Upload
- Same compression as MOD (max 500KB, 1200px)
- Reuse PhotoUpload component
- Photos shown in gallery view

## Navigation from MOD
- From MOD report problem section → link to existing WO
- Or create new WO with problem description pre-filled

## Firestore Security Rules
```javascript
// work_orders
match /work_orders/{woId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && role in ['super_admin', 'admin', 'hr', 'spv', 'manager'];
  allow update: if request.auth != null && (
    resource.data.createdBy == request.auth.uid ||
    role in ['super_admin', 'admin', 'hr']
  );
  allow delete: if request.auth != null && role in ['super_admin', 'admin'];
}

// work_threads
match /work_threads/{threadId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}
```

## Color Scheme for Status
- `open`: Red - perlu perhatian
- `in_progress`: Yellow - sedang dikerjakan
- `pending_approval`: Blue - menunggu persetujuan
- `completed`: Green - selesai
- `cancelled`: Gray - dibatalkan

## Priority Labels
- `low`: 🟢 Rendah
- `medium`: 🟡 Sedang
- `high`: 🟠 Tinggi
- `critical`: 🔴 Kritis (only for Urgent)