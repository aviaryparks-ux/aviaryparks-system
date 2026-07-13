// app/admin/payroll/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  doc,
  setDoc,
  serverTimestamp,
  limit,
  updateDoc
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/ui/LoadingScreen";
import PageHeader from "@/components/ui/PageHeader";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

type User = {
  uid: string;
  name: string;
  email: string;
  role?: string;
  employeeStatus?: string;
  dailyRate: number;
  monthlySalary?: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  jabatan: string;
  department: string;
  isActive?: boolean;
  photoUrl?: string;
};

type AttendanceRecord = {
  id: string;
  uid: string;
  name: string;
  email: string;
  date: Timestamp;
  shift: any;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  checkIn?: {
    time: Timestamp;
    photo?: string;
  };
  checkOut?: {
    time: Timestamp;
    photo?: string;
  };
  distance?: number;
};

type PayrollSummary = {
  uid: string;
  name: string;
  email: string;
  jabatan: string;
  department: string;
  dailyRate: number;
  monthlySalary?: number;
  isTraining?: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  totalDays: number;
  totalHours: number;
  totalSalary: number;
  photoUrl?: string;
  attendanceDetails: {
    id: string;
    date: string;
    checkIn: string;
    checkOut: string;
    workHours: number;
    dailyRate?: number;
  }[];
};

type PaymentStatus = {
  paidAt: Timestamp | null;
  paidBy: string | null;
};

export default function PayrollPage() {
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary[]>([]);
  const [editingRate, setEditingRate] = useState<{ id: string; currentRate: number } | null>(null);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [filteredSummary, setFilteredSummary] = useState<PayrollSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");

  const [allEmployees, setAllEmployees] = useState<{ uid: string; name: string; department: string }[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<PayrollSummary | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState<Map<string, PaymentStatus>>(new Map());
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute available employees based on selected department
  const availableEmployees = useMemo(() => {
    if (selectedDepartment === "ALL") {
      return allEmployees;
    }
    return allEmployees.filter((emp) => emp.department === selectedDepartment);
  }, [allEmployees, selectedDepartment]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearchTerm.trim()) return availableEmployees;
    return availableEmployees.filter((emp) =>
      emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
    );
  }, [availableEmployees, employeeSearchTerm]);

  // Disabled click outside - let user close manually
  // useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     const dropdown = document.getElementById('employee-dropdown-container');
  //     if (dropdown && !dropdown.contains(event.target as Node)) {
  //       setShowEmployeeDropdown(false);
  //     }
  //   };
  //   document.addEventListener("mousedown", handleClickOutside);
  //   return () => document.removeEventListener("mousedown", handleClickOutside);
  // }, []);

  // Load users and attendance data
  useEffect(() => {
    const initData = async () => {
      const uMap = await loadUsers();
      if (uMap) {
        await loadAttendanceData(uMap);
      }
    };
    initData();
  }, []);

  // Reload attendance when date range changes
  useEffect(() => {
    if (users.size > 0) {
      loadAttendanceData(users);
    }
  }, [dateRange]);

  useEffect(() => {
    applyFilters();
  }, [selectedDepartment, selectedEmployees, payrollSummary]);

  useEffect(() => {
    loadPaymentStatus();
  }, [filteredSummary, dateRange]);

  const loadUsers = async () => {
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), limit(500)));
      const usersMap = new Map<string, User>();
      const deptSet = new Set<string>();
      const empList: { uid: string; name: string; department: string }[] = [];

      usersSnap.forEach((doc) => {
        const data = doc.data();
        const department = data.department || "";

        if (data.isActive === false) return;

        if (department) deptSet.add(department);

        usersMap.set(doc.id, {
          uid: doc.id,
          name: data.name || "",
          email: data.email || "",
          dailyRate: data.dailyRate || 0,
          monthlySalary: data.monthlySalary || 0,
          bankName: data.bankName || "",
          bankAccountNumber: data.bankAccountNumber || "",
          bankAccountName: data.bankAccountName || "",
          jabatan: data.jabatan || "",
          department: department,
          isActive: data.isActive !== false,
          photoUrl: data.photoUrl || "",
        });

        empList.push({
          uid: doc.id,
          name: data.name || "",
          department: department,
        });
      });

      setUsers(usersMap);
      setDepartments(Array.from(deptSet).sort());
      setAllEmployees(empList.sort((a, b) => a.name.localeCompare(b.name)));
      return usersMap;
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Gagal memuat data karyawan");
      return null;
    }
  };

  const loadPaymentStatus = async () => {
    try {
      const periodKey = `${dateRange.startDate}_${dateRange.endDate}`;

      const paymentsSnap = await getDocs(
        query(collection(db, "payroll_payments"), where("periodKey", "==", periodKey))
      );

      const statusMap = new Map<string, PaymentStatus>();

      paymentsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.employees) {
          data.employees.forEach((emp: any) => {
            statusMap.set(emp.uid, {
              paidAt: emp.paidAt || null,
              paidBy: emp.paidBy || null,
            });
          });
        }
      });

      setPaymentStatus(statusMap);
    } catch (error) {
      console.error("Error loading payment status:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...payrollSummary];

    if (selectedDepartment !== "ALL") {
      filtered = filtered.filter((item) => item.department === selectedDepartment);
    }

    if (selectedEmployees.length > 0) {
      filtered = filtered.filter((item) => selectedEmployees.includes(item.uid));
    }

    setFilteredSummary(filtered);
  };

  const toggleEmployeeSelection = (uid: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const selectAllEmployees = () => {
    const allUids = availableEmployees.map((emp) => emp.uid);
    setSelectedEmployees(allUids);
  };

  const clearEmployeeSelection = () => {
    setSelectedEmployees([]);
  };

  const loadAttendanceData = async (currentUsersMap: Map<string, User> = users) => {
    setIsLoading(true);
    try {
      const startDateTime = new Date(dateRange.startDate);
      startDateTime.setHours(0, 0, 0, 0);

      const endDateTime = new Date(dateRange.endDate);
      endDateTime.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, "attendance"),
        where("date", ">=", Timestamp.fromDate(startDateTime)),
        where("date", "<=", Timestamp.fromDate(endDateTime)),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];

      calculatePayrollSummary(data, currentUsersMap);
    } catch (error) {
      console.error("Error loading attendance:", error);
      toast.error("Gagal memuat data absensi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDailyRate = async (attId: string, newRate: number) => {
    if (newRate < 0) return;
    setIsSavingRate(true);
    try {
      await updateDoc(doc(db, "attendance", attId), { dailyRate: newRate });
      alert("✅ Rate harian berhasil diubah!");
      setEditingRate(null);
      fetchData();
    } catch (error) {
      console.error(error);
      alert("❌ Gagal merubah rate");
    } finally {
      setIsSavingRate(false);
    }
  };

  const calculatePayrollSummary = (data: AttendanceRecord[], currentUsersMap: Map<string, User>) => {
    const summaryMap = new Map<string, PayrollSummary>();
    const endDt = new Date(dateRange.endDate);
    const daysInMonth = new Date(endDt.getFullYear(), endDt.getMonth() + 1, 0).getDate();

    data.forEach((att) => {
      if (!att.checkIn?.time) return;

      const uid = att.uid;
      const user = currentUsersMap.get(uid);
      if (!user || user.isActive === false) return;

      const dailyRate = user?.dailyRate || 0;
      const monthlySalary = user?.monthlySalary || 0;
      const department = user?.department || "";
      const isTraining = user?.role === "training" || user?.employeeStatus === "Training" || user?.jabatan === "Training" || user?.employeeStatus === "Intern / Magang" || user?.jabatan === "Intern / Magang";

      const checkInTime = att.checkIn.time.toDate();
      let checkOutTime;
      let checkOutStr;

      if (att.checkOut?.time) {
        checkOutTime = att.checkOut.time.toDate();
        checkOutStr = checkOutTime.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        // Otomatis diset ke jam 17:00 pada hari yang sama
        checkOutTime = new Date(checkInTime);
        checkOutTime.setHours(17, 0, 0, 0);
        
        // Jaga-jaga jika check-in malam setelah jam 17:00
        if (checkOutTime.getTime() < checkInTime.getTime()) {
          checkOutTime = new Date(checkInTime.getTime() + (1 * 60 * 60 * 1000));
          checkOutStr = checkOutTime.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }) + " (Auto)";
        } else {
          checkOutStr = "17:00 (Auto)";
        }
      }

      const workHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      const dateStr = att.date.toDate().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      const checkInStr = checkInTime.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (!summaryMap.has(uid)) {
        summaryMap.set(uid, {
          uid: uid,
          name: att.name || user?.name || "-",
          email: att.email || user?.email || "-",
          jabatan: user?.jabatan || "-",
          department: department,
          dailyRate: dailyRate,
          monthlySalary: monthlySalary,
          isTraining: isTraining,
          bankName: user?.bankName || "-",
          bankAccountNumber: user?.bankAccountNumber || "-",
          bankAccountName: user?.bankAccountName || "-",
          totalDays: 0,
          totalHours: 0,
          totalSalary: 0,
          photoUrl: user?.photoUrl,
          attendanceDetails: [],
        });
      }

      const existing = summaryMap.get(uid)!;
      existing.totalDays += 1;
      existing.totalHours += workHours;
      
      const currentAttRate = (att as any).dailyRate !== undefined ? (att as any).dailyRate : dailyRate;

      if (existing.isTraining) {
        existing.totalSalary = Math.round(((existing.monthlySalary || 0) / daysInMonth) * existing.totalDays);
      } else {
        existing.totalSalary += currentAttRate;
      }
      
      existing.attendanceDetails.push({
        id: att.id,
        date: dateStr,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        workHours: workHours,
        dailyRate: currentAttRate,
      });
    });

    const result = Array.from(summaryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPayrollSummary(result);
  };

  const markAsPaid = async () => {
    if (selectedEmployees.length === 0) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }

    setIsUpdatingPayment(true);
    try {
      // Overlap check
      const allPaymentsSnap = await getDocs(collection(db, "payroll_payments"));
      const currentStart = new Date(dateRange.startDate);
      const currentEnd = new Date(dateRange.endDate);
      
      let isOverlapping = false;
      let overlappingPeriod = "";

      allPaymentsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.periodKey === `${dateRange.startDate}_${dateRange.endDate}`) return;
        
        const existStart = new Date(data.startDate);
        const existEnd = new Date(data.endDate);

        if (currentStart <= existEnd && currentEnd >= existStart) {
          isOverlapping = true;
          overlappingPeriod = `${data.startDate} s/d ${data.endDate}`;
        }
      });

      if (isOverlapping) {
        const confirmMsg = `⚠️ PERINGATAN: Rentang tanggal ini tumpang tindih dengan periode pembayaran lain (${overlappingPeriod}).\n\nMelanjutkan proses ini berpotensi menyebabkan perhitungan gaji ganda (karyawan dibayar dua kali untuk tanggal yang sama).\n\nYakin ingin melanjutkan?`;
        if (!window.confirm(confirmMsg)) {
          setIsUpdatingPayment(false);
          return;
        }
      }

      const periodKey = `${dateRange.startDate}_${dateRange.endDate}`;
      const docId = `payment_${periodKey.replace(/-/g, "")}`;

      const existingSnap = await getDocs(
        query(collection(db, "payroll_payments"), where("periodKey", "==", periodKey))
      );

      let employees = selectedEmployees.map((uid) => ({
        uid,
        paidAt: Timestamp.now(),
        paidBy: "current_admin",
      }));

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();
        const existingEmployees = existingData.employees || [];

        const mergedMap = new Map<string, any>();

        existingEmployees.forEach((emp: any) => {
          mergedMap.set(emp.uid, emp);
        });

        selectedEmployees.forEach((uid) => {
          mergedMap.set(uid, {
            uid,
            paidAt: Timestamp.now(),
            paidBy: "current_admin",
          });
        });

        employees = Array.from(mergedMap.values());

        await setDoc(doc(db, "payroll_payments", existingDoc.id), {
          employees,
          periodKey,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await setDoc(doc(db, "payroll_payments", docId), {
          employees,
          periodKey,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const newStatus = new Map(paymentStatus);
      selectedEmployees.forEach((uid) => {
        newStatus.set(uid, {
          paidAt: Timestamp.now(),
          paidBy: "current_admin",
        });
      });
      setPaymentStatus(newStatus);

      toast.success(`${selectedEmployees.length} karyawan berhasil ditandai Paid`);
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Gagal menandai Paid");
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const markAsUnpaid = async () => {
    if (selectedEmployees.length === 0) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }

    setIsUpdatingPayment(true);
    try {
      const periodKey = `${dateRange.startDate}_${dateRange.endDate}`;

      const existingSnap = await getDocs(
        query(collection(db, "payroll_payments"), where("periodKey", "==", periodKey))
      );

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();
        const existingEmployees = existingData.employees || [];

        const mergedMap = new Map<string, any>();
        existingEmployees.forEach((emp: any) => {
          mergedMap.set(emp.uid, emp);
        });

        selectedEmployees.forEach((uid) => {
          mergedMap.set(uid, {
            uid,
            paidAt: null,
            paidBy: null,
          });
        });

        const employees = Array.from(mergedMap.values());

        await setDoc(doc(db, "payroll_payments", existingSnap.docs[0].id), {
          employees,
          periodKey,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const newStatus = new Map(paymentStatus);
        selectedEmployees.forEach((uid) => {
          newStatus.set(uid, {
            paidAt: null,
            paidBy: null,
          });
        });
        setPaymentStatus(newStatus);

        toast.success(`${selectedEmployees.length} karyawan berhasil ditandai Unpaid`);
      } else {
        toast.error("Tidak ada data pembayaran untuk periode ini");
      }
    } catch (error) {
      console.error("Error marking as unpaid:", error);
      toast.error("Gagal menandai Unpaid");
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const toggleRowSelection = (uid: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const selectAllVisible = () => {
    const visibleUids = filteredSummary.map((item) => item.uid);
    setSelectedEmployees(visibleUids);
  };

  const clearAllSelection = () => {
    setSelectedEmployees([]);
  };

  const exportToExcel = () => {
    if (filteredSummary.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    // Sheet 1: Summary data
    const excelData = filteredSummary.map((item, index) => {
      const status = paymentStatus.get(item.uid);
      const paidStatus = status?.paidAt ? "Paid" : "Unpaid";

      return {
        No: index + 1,
        "Nama Karyawan": item.name,
        Email: item.email,
        Departemen: item.department,
        Jabatan: item.jabatan,
        "Rate Harian": item.isTraining ? `Rp ${(item.monthlySalary || 0).toLocaleString()} / bln (Prorata)` : (new Set(item.attendanceDetails.map(d => d.dailyRate || 0)).size > 1 ? "Beragam (Multi-Rate)" : `Rp ${(item.attendanceDetails[0]?.dailyRate || item.dailyRate).toLocaleString()}`),
        Bank: item.bankName,
        "Nomor Rekening": item.bankAccountNumber && item.bankAccountNumber !== "-" ? `'${item.bankAccountNumber}` : "-",
        "Nama Pemilik": item.bankAccountName,
        "Total Hari Kerja": `${item.totalDays}x`,
        "Total Jam Kerja": `${item.totalHours.toFixed(1)} jam`,
        "Total Gaji": `Rp ${item.totalSalary.toLocaleString()}`,
        "Status Bayar": paidStatus,
      };
    });

    const totalSalary = filteredSummary.reduce((sum, item) => sum + item.totalSalary, 0);
    const totalDays = filteredSummary.reduce((sum, item) => sum + item.totalDays, 0);
    const totalHours = filteredSummary.reduce((sum, item) => sum + item.totalHours, 0);

    const totalRow: any = {
      No: "",
      "Nama Karyawan": "TOTAL",
      Email: "",
      Departemen: "",
      Jabatan: "",
      "Rate Harian": "",
      Bank: "",
      "Nomor Rekening": "",
      "Nama Pemilik": "",
      "Total Hari Kerja": `${totalDays}x masuk`,
      "Total Jam Kerja": `${totalHours.toFixed(1)} jam`,
      "Total Gaji": `Rp ${totalSalary.toLocaleString()}`,
      "Status Bayar": "",
    };

    excelData.push(totalRow);

    // Sheet 2: Detail all attendance
    const detailData: any[] = [];
    filteredSummary.forEach((item, index) => {
      // Add employee header
      detailData.push({
        "No": `Karyawan ${index + 1}`,
        "Nama": item.name,
        "Departemen": item.department,
        "Total Masuk": `${item.totalDays}x`,
        "": "",
        "": "",
        "": "",
        "": "",
      });

      // Add attendance details
      item.attendanceDetails.forEach((att, attIdx) => {
        detailData.push({
          "No": attIdx + 1,
          "Nama": att.date,
          "Departemen": att.checkIn,
          "Jabatan": att.checkOut,
          "Rate Harian": `${att.workHours.toFixed(1)} jam`,
          "": "",
          "": "",
          "": "",
          "": "",
        });
      });

      // Empty row separator
      detailData.push({
        No: "",
        "Nama Karyawan": "",
        Email: "",
        Departemen: "",
        Jabatan: "",
        "Rate Harian": "",
        Bank: "",
        "Nomor Rekening": "",
        "Nama Pemilik": "",
        "Total Hari Kerja": "",
        "Total Jam Kerja": "",
        "Total Gaji": "",
        "Status Bayar": "",
      });
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rekap Gaji
    const summaryWs = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Rekap Gaji");

    // Sheet 2: Detail Absensi (format lebih jelas)
    const detailRows: any[] = [];

    filteredSummary.forEach((item, index) => {
      // Header employee
      detailRows.push({
        "No": `===== ${item.name} (${item.department || '-'}) =====`,
        "Tanggal": item.isTraining ? `Gaji Pokok: ${formatCurrency(item.monthlySalary || 0)} (Prorata) | Total: ${formatCurrency(item.totalSalary)}` : `Rate: ${new Set(item.attendanceDetails.map(d => d.dailyRate || 0)).size > 1 ? "Beragam (Multi-Rate)" : formatCurrency(item.attendanceDetails[0]?.dailyRate || item.dailyRate)} | Total: ${formatCurrency(item.totalSalary)}`,
        "Jam Masuk": "",
        "Jam Pulang": "",
        "Durasi": "",
      });

      // Each attendance row
      item.attendanceDetails.forEach((att, idx) => {
        detailRows.push({
          "No": idx + 1,
          "Tanggal": item.isTraining ? att.date : `${att.date} (Rate: ${formatCurrency(att.dailyRate || item.dailyRate)})`,
          "Jam Masuk": att.checkIn,
          "Jam Pulang": att.checkOut,
          "Durasi": `${att.workHours.toFixed(1)} jam`,
        });
      });

      // Total row
      detailRows.push({
        "No": "",
        "Tanggal": "SUBTOTAL",
        "Jam Masuk": `${item.totalDays}x masuk`,
        "Jam Pulang": "",
        "Durasi": `${item.totalHours.toFixed(1)} jam`,
      });

      // Empty separator
      detailRows.push({
        "No": "",
        "Tanggal": "",
        "Jam Masuk": "",
        "Jam Pulang": "",
        "Durasi": "",
      });
    });

    const detailWs = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, detailWs, "Detail Absensi");

    const sanitizeFilename = (name: string) => {
      return name.replace(/[<>:"/\\|?*]/g, "").trim() || "data";
    };

    const safeName = selectedEmployees.length === 1
      ? sanitizeFilename(filteredSummary[0]?.name || "data")
      : selectedDepartment !== "ALL"
        ? sanitizeFilename(selectedDepartment)
        : "all";

    const fileName = `rekap_gaji_${safeName}_${dateRange.startDate}_${dateRange.endDate}.xlsx`;

    XLSX.writeFile(wb, fileName);
    toast.success("Export Excel berhasil");
  };

  const exportDetailToExcel = (employee: PayrollSummary) => {
    // Header info section
    const headerInfo = [
      { Label: "Nama Karyawan", Value: employee.name },
      { Label: "Departemen", Value: employee.department || "-" },
      { Label: "Jabatan", Value: employee.jabatan },
      { Label: employee.isTraining ? "Gaji Pokok Bulanan" : "Rate Harian", Value: employee.isTraining ? formatCurrency(employee.monthlySalary || 0) : (new Set(employee.attendanceDetails.map(d => d.dailyRate || 0)).size > 1 ? "Beragam (Multi-Rate)" : formatCurrency(employee.attendanceDetails[0]?.dailyRate || employee.dailyRate)) },
      { Label: "Periode", Value: `${dateRange.startDate} - ${dateRange.endDate}` },
      { Label: "", Value: "" },
      { Label: "Total Hari Kerja", Value: `${employee.totalDays} hari` },
      { Label: "Total Jam Kerja", Value: formatTime(employee.totalHours) },
      { Label: "Total Gaji", Value: formatCurrency(employee.totalSalary) },
    ];

    // Detail attendance section
    const detailData = [
      ...employee.attendanceDetails.map((item, index) => ({
        "No": index + 1,
        "Tanggal": item.date,
        "Jam Masuk": item.checkIn,
        "Jam Pulang": item.checkOut,
        "Durasi (Jam)": item.workHours.toFixed(1),
      })),
      {
        "No": "",
        "Tanggal": "TOTAL",
        "Jam Masuk": `${employee.totalDays}x masuk`,
        "Jam Pulang": "",
        "Durasi (Jam)": employee.totalHours.toFixed(1),
      },
    ];

    // Create workbook with header info and detail
    const wb = XLSX.utils.book_new();

    // Sheet 1: Info & Summary
    const infoWs = XLSX.utils.json_to_sheet(headerInfo);
    XLSX.utils.book_append_sheet(wb, infoWs, "Info Karyawan");

    // Sheet 2: Detail Absensi
    const detailWs = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailWs, "Detail Absensi");

    // Sanitize filename
    const sanitizeFilename = (name: string) => {
      return name.replace(/[<>:"/\\|?*]/g, "").trim() || "data";
    };

    const fileName = `detail_absensi_${sanitizeFilename(employee.name)}_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Export detail ${employee.name} berhasil`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h} jam`;
    return `${h} jam ${m} menit`;
  };

  const formatPaidDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  };

  const getSelectedEmployeeNames = () => {
    if (selectedEmployees.length === 0) return "Semua Karyawan";
    if (selectedEmployees.length === 1) {
      const emp = allEmployees.find((e) => e.uid === selectedEmployees[0]);
      return emp ? emp.name : "1 karyawan";
    }
    return `${selectedEmployees.length} karyawan terpilih`;
  };

  const totalFilteredSalary = filteredSummary.reduce((sum, item) => sum + item.totalSalary, 0);
  const totalFilteredDays = filteredSummary.reduce((sum, item) => sum + item.totalDays, 0);
  const totalFilteredHours = filteredSummary.reduce((sum, item) => sum + item.totalHours, 0);
  const totalFilteredEmployees = filteredSummary.length;

  const paidCount = filteredSummary.filter((item) => paymentStatus.get(item.uid)?.paidAt).length;
  const unpaidCount = filteredSummary.length - paidCount;

  return (
    <ProtectedRoute requiredFeature="manage_payroll">
      <div className="space-y-6 pb-20">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Employees */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Karyawan</p>
              <p className="text-2xl font-bold text-slate-800">{totalFilteredEmployees}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">orang</p>
            </div>
          </div>

          {/* Total Days */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Hari Kerja</p>
              <p className="text-2xl font-bold text-slate-800">{totalFilteredDays}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">hari</p>
            </div>
          </div>

          {/* Total Hours */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Jam Kerja</p>
              <p className="text-2xl font-bold text-slate-800">{formatTime(totalFilteredHours)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">efektif</p>
            </div>
          </div>

          {/* Total Salary */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Gaji</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalFilteredSalary)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">bruto</p>
            </div>
          </div>
        </div>

        {/* Payment Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Paid Count */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Sudah Dibayar</p>
              <p className="text-2xl font-bold text-emerald-600">{paidCount} <span className="text-xs font-normal text-slate-400">karyawan</span></p>
            </div>
          </div>

          {/* Unpaid Count */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 border-l-4 border-l-amber-500 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Belum Dibayar</p>
              <p className="text-2xl font-bold text-amber-600">{unpaidCount} <span className="text-xs font-normal text-slate-400">karyawan</span></p>
            </div>
          </div>

          {/* Selected Count */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 border-l-4 border-l-sky-500 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Dipilih</p>
              <p className="text-2xl font-bold text-sky-600">{selectedEmployees.length} <span className="text-xs font-normal text-slate-400">karyawan</span></p>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible transition-all duration-300">
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/40 transition-colors rounded-t-2xl"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Filter & Pencarian</h2>
            </div>
            <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 px-6 pb-6 ${isFilterOpen ? 'block' : 'hidden'}`}>
            {/* Date Start */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tanggal Mulai</label>
                <div className="relative border border-slate-200 rounded-xl bg-white hover:border-sky-300 transition-colors focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500">
                  <DatePicker
                    selected={dateRange.startDate ? new Date(dateRange.startDate) : undefined}
                    onChange={(date: Date | null) => {
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setDateRange({ ...dateRange, startDate: `${y}-${m}-${d}` });
                      }
                    }}
                    dateFormat="dd/MM/yyyy"
                    className="w-full bg-transparent px-4 py-3 text-sm text-slate-700 outline-none border-none focus:ring-0 cursor-pointer"
                    wrapperClassName="w-full"
                    placeholderText="Pilih tanggal mulai"
                  />
                </div>
            </div>

            {/* Date End */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tanggal Akhir</label>
                <div className="relative border border-slate-200 rounded-xl bg-white hover:border-sky-300 transition-colors focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500">
                  <DatePicker
                    selected={dateRange.endDate ? new Date(dateRange.endDate) : undefined}
                    onChange={(date: Date | null) => {
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setDateRange({ ...dateRange, endDate: `${y}-${m}-${d}` });
                      }
                    }}
                    dateFormat="dd/MM/yyyy"
                    className="w-full bg-transparent px-4 py-3 text-sm text-slate-700 outline-none border-none focus:ring-0 cursor-pointer"
                    wrapperClassName="w-full"
                    placeholderText="Pilih tanggal akhir"
                  />
                </div>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Departemen</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
              >
                <option value="ALL">Semua Departemen</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-3">
              <button
                onClick={() => { loadUsers(); loadAttendanceData(); }}
                className="btn-primary px-5 py-3 text-white rounded-xl font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Tampilkan
              </button>
              <button
                onClick={exportToExcel}
                disabled={filteredSummary.length === 0}
                className="px-5 py-3 bg-white border-2 border-emerald-500 text-emerald-600 rounded-xl font-medium hover:bg-emerald-50 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* Payment Actions */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
            <div className="flex-1">
              <p className="text-sm text-slate-600 font-medium">
                {selectedEmployees.length > 0 ? (
                  <span className="text-sky-600">{selectedEmployees.length} karyawan dipilih</span>
                ) : (
                  "Klik checkbox pada tabel untuk memilih karyawan"
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAllVisible}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 transition-all"
              >
                Pilih Semua
              </button>
              <button
                onClick={clearAllSelection}
                disabled={selectedEmployees.length === 0}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-2 border-l border-slate-300 pl-3">
              <button
                onClick={markAsPaid}
                disabled={selectedEmployees.length === 0 || isUpdatingPayment}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isUpdatingPayment ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Mark Paid
              </button>
              <button
                onClick={markAsUnpaid}
                disabled={selectedEmployees.length === 0 || isUpdatingPayment}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                {isUpdatingPayment ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Mark Unpaid
              </button>
            </div>
          </div>
        </div>

        {/* Employee Dropdown Section - placed above table */}
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <label className="text-sm font-medium text-slate-700 mb-3 block">Pilih Karyawan</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
              className="w-full px-4 py-3 text-left bg-white border border-slate-200 rounded-xl flex justify-between items-center hover:bg-slate-50 transition-all"
            >
              <span className={selectedEmployees.length === 0 ? "text-slate-400" : "text-slate-700 font-medium"}>
                {getSelectedEmployeeNames()}
              </span>
              <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showEmployeeDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showEmployeeDropdown && (
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-96 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-blue-50">
                  <span className="font-semibold text-slate-700">Pilih Karyawan ({availableEmployees.length})</span>
                  <button onClick={() => setShowEmployeeDropdown(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="p-3 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Ketik untuk cari nama..."
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                </div>
                <div className="p-2 border-b border-slate-100 bg-slate-50 flex gap-3">
                  <button onClick={selectAllEmployees} className="text-xs text-sky-600 hover:text-sky-800 font-medium">
                    Pilih Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button onClick={clearEmployeeSelection} className="text-xs text-red-500 hover:text-red-700 font-medium">
                    Reset
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredEmployees.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      {employeeSearchTerm ? "Karyawan tidak ditemukan" : "Tidak ada karyawan"}
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <label key={emp.uid} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.uid)}
                          onChange={() => toggleEmployeeSelection(emp.uid)}
                          className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm text-slate-700 flex-1">{emp.name}</span>
                        {selectedDepartment === "ALL" && (
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{emp.department}</span>
                        )}
                        {paymentStatus.get(emp.uid)?.paidAt && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">Paid</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected Tags */}
          {selectedEmployees.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedEmployees.slice(0, 5).map((uid) => {
                const emp = allEmployees.find((e) => e.uid === uid);
                return emp ? (
                  <span key={uid} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 text-sky-700 text-xs rounded-lg font-medium">
                    {emp.name}
                    <button onClick={() => toggleEmployeeSelection(uid)} className="hover:text-sky-900 font-bold">×</button>
                  </span>
                ) : null;
              })}
              {selectedEmployees.length > 5 && (
                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg font-medium">
                  +{selectedEmployees.length - 5} lainnya
                </span>
              )}
            </div>
          )}
        </div>

        {/* Table Section */}
        <div className={`table-container overflow-hidden animate-slide-up`} style={{ animationDelay: '0.6s' }}>
          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Detail Rekap Gaji
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Klik checkbox untuk memilih, klik baris untuk lihat detail
                </p>
              </div>
              <div className="text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                Menampilkan <span className="font-bold text-sky-600">{filteredSummary.length}</span> dari <span className="font-bold">{payrollSummary.length}</span> karyawan
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-16 text-center">
              <LoadingScreen fullScreen={false} message="Memuat data gaji..." size={120} />
            </div>
          ) : filteredSummary.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">Tidak ada data absensi dalam periode ini</p>
              <p className="text-slate-400 text-sm mt-1">Pilih periode tanggal lain atau ubah filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-4 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.length === filteredSummary.length && filteredSummary.length > 0}
                        onChange={(e) => e.target.checked ? selectAllVisible() : clearAllSelection()}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">No</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Karyawan</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Departemen</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Jabatan</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate Harian</th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Hari</th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Jam Kerja</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider bg-emerald-50">Total Gaji</th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummary.map((item, index) => {
                    const status = paymentStatus.get(item.uid);
                    const isPaid = !!status?.paidAt;
                    const paidDate = status?.paidAt ? formatPaidDate(status.paidAt) : "";

                    return (
                      <tr
                        key={item.uid}
                        className="table-row-hover cursor-pointer"
                        style={{ animationDelay: `${0.1 * index}s` }}
                        onClick={() => {
                          setSelectedEmployee(item);
                          setShowDetailModal(true);
                        }}
                      >
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(item.uid)}
                            onChange={() => toggleRowSelection(item.uid)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-4 py-4 text-slate-400 font-medium">{index + 1}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden bg-gradient-to-br from-sky-400 to-indigo-500">
                              {item.photoUrl ? (
                                <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                item.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-semibold text-slate-700">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                            {item.department || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 text-sm">{item.jabatan}</td>
                        <td className="px-4 py-4 text-right text-slate-700 font-medium">
                          {item.isTraining ? (
                            <div className="flex flex-col items-end">
                              <span>{formatCurrency(item.monthlySalary || 0)}</span>
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded mt-0.5">Bulanan (Prorata)</span>
                            </div>
                          ) : (
                            new Set(item.attendanceDetails.map(d => d.dailyRate || 0)).size > 1 ? <span className="text-amber-600 font-medium text-[13px]">Beragam (Multi-Rate)</span> : formatCurrency(item.attendanceDetails[0]?.dailyRate || item.dailyRate)
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold">{item.totalDays} hari</span>
                        </td>
                        <td className="px-4 py-4 text-center text-slate-600 text-sm">{formatTime(item.totalHours)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                            {formatCurrency(item.totalSalary)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs rounded-lg font-semibold">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Paid {paidDate && <span className="text-emerald-500 ml-1">({paidDate})</span>}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs rounded-lg font-semibold">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Unpaid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
                    <td colSpan={6} className="px-4 py-4 text-right font-bold text-slate-700">TOTAL</td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">{totalFilteredDays} hari</span>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-700">{formatTime(totalFilteredHours)}</td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        {formatCurrency(totalFilteredSalary)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                        {paidCount} Paid / {unpaidCount} Unpaid
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Zero Rate Warning */}
        {filteredSummary.filter((item) => item.isTraining ? (item.monthlySalary === 0 || !item.monthlySalary) : (item.attendanceDetails.length > 0 ? item.attendanceDetails.some(d => (d.dailyRate || 0) === 0) : item.dailyRate === 0)).length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-red-500 p-5 animate-slide-up" style={{ animationDelay: '0.7s' }}>
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-red-700">Perhatian: Ada Rate yang Belum Diisi!</p>
                <p className="text-sm text-red-600 mt-1">Karyawan berikut belum diisi rate harian / bulanan-nya:</p>
                <ul className="text-sm text-red-600 mt-2 space-y-1">
                  {filteredSummary.filter((item) => item.isTraining ? (item.monthlySalary === 0 || !item.monthlySalary) : (item.attendanceDetails.length > 0 ? item.attendanceDetails.some(d => (d.dailyRate || 0) === 0) : item.dailyRate === 0)).map((item) => (
                    <li key={item.uid} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      {item.name} ({item.department || "No Dept"})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-sky-500 p-5 animate-slide-up" style={{ animationDelay: '0.75s' }}>
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Catatan Penting</p>
              <ul className="text-sm text-slate-600 mt-2 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0" />
                  Rate harian diambil dari data masing-masing karyawan (menu Users)
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0" />
                  Perhitungan gaji = Rate Harian x Total Hari Kerja
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0" />
                  Gunakan filter untuk rekap spesifik per karyawan atau departemen
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0" />
                  Klik "Mark Paid" untuk menandai karyawan sudah dibayar
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 flex-shrink-0" />
                  Harap verifikasi ulang sebelum transfer gaji
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Detail */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4">
          <div className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Detail Absensi {selectedEmployee.name}</h2>
                <p className="text-slate-400 text-sm mt-1">{selectedEmployee.department} - {selectedEmployee.jabatan}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Hari Kerja</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{selectedEmployee.totalDays} hari</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Jam Kerja</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{formatTime(selectedEmployee.totalHours)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{selectedEmployee.isTraining ? "Gaji Pokok" : "Rate Harian"}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{selectedEmployee.isTraining ? formatCurrency(selectedEmployee.monthlySalary || 0) : (new Set(selectedEmployee.attendanceDetails.map(d => d.dailyRate || 0)).size > 1 ? "Beragam (Multi-Rate)" : formatCurrency(selectedEmployee.attendanceDetails[0]?.dailyRate || selectedEmployee.dailyRate))}</p>
                  {selectedEmployee.isTraining && <p className="text-[10px] text-slate-400 mt-1">Sistem Prorata Bulanan</p>}
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Total Gaji</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(selectedEmployee.totalSalary)}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Jam Masuk</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Jam Pulang</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Jam Kerja</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Rate Harian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEmployee.attendanceDetails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-700 font-medium">{item.date}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600">{item.checkIn}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-600">{item.checkOut}</td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium">{formatTime(item.workHours)}</td>
                        <td className="px-4 py-3 text-right">
                          {editingRate?.id === item.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-sky-500"
                                value={editingRate.currentRate}
                                onChange={(e) => setEditingRate({ ...editingRate, currentRate: Number(e.target.value) })}
                                disabled={isSavingRate}
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateDailyRate(item.id, editingRate.currentRate)}
                                disabled={isSavingRate}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button
                                onClick={() => setEditingRate(null)}
                                disabled={isSavingRate}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => !selectedEmployee.isTraining && setEditingRate({ id: item.id, currentRate: item.dailyRate || 0 })}
                              className={`inline-flex items-center gap-1 ${!selectedEmployee.isTraining ? 'cursor-pointer group hover:bg-slate-100' : ''} px-2 py-1 rounded`}
                              title={!selectedEmployee.isTraining ? "Klik untuk ubah rate di tanggal ini" : "Karyawan training menggunakan sistem Prorata"}
                            >
                              <span className="font-medium text-slate-700">{formatCurrency(item.dailyRate || 0)}</span>
                              {!selectedEmployee.isTraining && (
                                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold">
                    <tr>
                      <td className="px-4 py-3">TOTAL</td>
                      <td className="px-4 py-3 text-center">-</td>
                      <td className="px-4 py-3 text-center">-</td>
                      <td className="px-4 py-3 text-right">{formatTime(selectedEmployee.totalHours)}</td>
                      <td className="px-4 py-3 text-right">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => exportDetailToExcel(selectedEmployee)}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}