// lib/chat/department.ts
// Auto-generate department groups (HOD-Staf style) for Next.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";
import { createGroupChat, addMemberToGroup } from "./firebase";

interface Department {
  id: string;
  name: string;
  hodUid: string;
  sections?: Section[];
}

interface Section {
  id: string;
  name: string;
  managerUid: string;
  divisions?: Division[];
}

interface Division {
  id: string;
  name: string;
  spvUid: string;
}

interface User {
  uid: string;
  name: string;
  department?: string;
  isActive?: boolean;
}

/**
 * Ensure all department groups exist (creates if not exists)
 * Call this on app startup or when departments change
 */
export async function ensureDepartmentGroups(): Promise<void> {
  try {
    // Get all departments
    const deptSnapshot = await getDocs(collection(db, "departments"));

    for (const deptDoc of deptSnapshot.docs) {
      const deptData = deptDoc.data() as Department;
      const deptId = deptDoc.id;
      const deptName = deptData.name || "";
      const hodUid = deptData.hodUid || "";

      if (!hodUid) continue;

      // Get HOD info
      const hodDoc = await getDoc(doc(db, "users", hodUid));
      const hodName = hodDoc.data()?.name || "HOD";

      // Get all department members
      const members: { uid: string; name: string }[] = [];
      const usersSnapshot = await getDocs(
        query(
          collection(db, "users"),
          where("department", "==", deptName.toUpperCase()),
          where("isActive", "==", true)
        )
      );

      usersSnapshot.docs.forEach((userDoc) => {
        const userData = userDoc.data() as User;
        if (userData.name) {
          members.push({
            uid: userDoc.id,
            name: userData.name,
          });
        }
      });

      if (members.length === 0) continue;

      // Check if group already exists
      const existingGroup = await findExistingGroup(deptId);
      if (existingGroup) {
        // Update members if needed
        await updateGroupMembers(existingGroup, members, hodUid);
      } else {
        // Create new group
        await createGroupChat({
          name: `HOF - ${deptName}`,
          description: `Grup Head of Department & Staff ${deptName}`,
          memberIds: members.map((m) => m.uid),
          memberNames: members.map((m) => m.name),
          departmentId: deptId,
          isAutoCreated: true,
        });
        console.log(`Created department group: HOF - ${deptName}`);
      }
    }
  } catch (error) {
    console.error("Error ensuring department groups:", error);
  }
}

/**
 * Find existing department group by department ID
 */
async function findExistingGroup(departmentId: string): Promise<string | null> {
  const snapshot = await getDocs(
    query(
      collection(db, "conversations"),
      where("departmentId", "==", departmentId),
      where("isAutoCreated", "==", true)
    )
  );

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  return null;
}

/**
 * Update group members when department membership changes
 */
async function updateGroupMembers(
  groupId: string,
  newMembers: { uid: string; name: string }[],
  hodUid: string
): Promise<void> {
  const groupDoc = await getDoc(doc(db, "conversations", groupId));
  if (!groupDoc.exists) return;

  const existingMemberIds = groupDoc.data()?.memberIds || [];

  // Add new members
  for (const member of newMembers) {
    if (!existingMemberIds.includes(member.uid)) {
      await addMemberToGroup(groupId, member.uid, member.name);
    }
  }
}

/**
 * Delete department group when department is deleted
 */
export async function deleteDepartmentGroup(departmentId: string): Promise<void> {
  const groupId = await findExistingGroup(departmentId);
  if (groupId) {
    await deleteDoc(doc(db, "conversations", groupId));
  }
}

/**
 * Sync group when employee changes department
 */
export async function onEmployeeDepartmentChanged(
  employeeId: string,
  employeeName: string,
  oldDepartmentId: string | null,
  newDepartmentId: string | null
): Promise<void> {
  // Remove from old department group
  if (oldDepartmentId) {
    const oldGroupId = await findExistingGroup(oldDepartmentId);
    if (oldGroupId) {
      await updateDoc(doc(db, "conversations", oldGroupId), {
        memberIds: arrayRemove(employeeId),
      });
    }
  }

  // Add to new department group
  if (newDepartmentId) {
    const newGroupId = await findExistingGroup(newDepartmentId);
    if (newGroupId) {
      await addMemberToGroup(newGroupId, employeeId, employeeName);
    }
  }
}

/**
 * Manual sync all department groups
 * Use this for admin maintenance
 */
export async function syncAllDepartmentGroups(): Promise<void> {
  console.log("Starting department groups sync...");
  await ensureDepartmentGroups();
  console.log("Department groups sync complete.");
}
