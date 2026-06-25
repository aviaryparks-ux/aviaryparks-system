"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, updateDoc, serverTimestamp, query, where, getDocs, getDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppEvent, FEOData } from "@/types/event";
import LoadingScreen from "@/components/ui/LoadingScreen";
import toast from "react-hot-toast";

export default function EditFEOPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [users, setUsers] = useState<any[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<any[]>([]);

  const [formData, setFormData] = useState<AppEvent | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchEvent();
  }, [user, params.id]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("name"));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(d => ({
        uid: d.id,
        ...d.data()
      })).filter(u => u.uid !== user?.uid);
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchEvent = async () => {
    if (!params.id) return;
    try {
      const docRef = doc(db, "events", params.id as string);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as AppEvent;
        // Security check
        if ((data.status !== "draft" && data.status !== "negotiation" && data.status !== "rejected") ||
            (data.createdBy !== user?.uid && user?.role !== "super_admin")) {
          toast.error("Anda tidak memiliki akses untuk mengubah dokumen ini");
          router.replace("/events/feo");
          return;
        }
        
        setFormData({ id: docSnap.id, ...data });
        
        // Restore approvers
        if (data.approvalFlow) {
          const approvers = data.approvalFlow.map(flow => ({
            uid: flow.approverUid,
            name: flow.approverName,
            role: flow.approverRole,
            actionType: flow.actionType
          }));
          setSelectedApprovers(approvers);
        }
      } else {
        toast.error("Dokumen tidak ditemukan");
        router.replace("/events/feo");
      }
    } catch (error) {
      console.error("Error fetching FEO:", error);
      toast.error("Gagal memuat data FEO");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleAddApprover = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uid = e.target.value;
    if (!uid) return;
    
    const selectedUser = users.find(u => u.uid === uid);
    if (selectedUser && !selectedApprovers.some(a => a.uid === uid)) {
      setSelectedApprovers([...selectedApprovers, { ...selectedUser, actionType: "Menyetujui" }]);
    }
    e.target.value = "";
  };

  const handleRemoveApprover = (indexToRemove: number) => {
    setSelectedApprovers(selectedApprovers.filter((_, idx) => idx !== indexToRemove));
  };

  const updateApproverAction = (index: number, actionType: string) => {
    const newApprovers = [...selectedApprovers];
    newApprovers[index].actionType = actionType;
    setSelectedApprovers(newApprovers);
  };

  const moveApprover = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newApprovers = [...selectedApprovers];
      [newApprovers[index - 1], newApprovers[index]] = [newApprovers[index], newApprovers[index - 1]];
      setSelectedApprovers(newApprovers);
    } else if (direction === 'down' && index < selectedApprovers.length - 1) {
      const newApprovers = [...selectedApprovers];
      [newApprovers[index + 1], newApprovers[index]] = [newApprovers[index], newApprovers[index + 1]];
      setSelectedApprovers(newApprovers);
    }
  };

  const handleChange = (field: string, value: any) => {
    if (!formData) return;
    if (field.startsWith("feo.")) {
      const feoField = field.split(".")[1];
      setFormData(prev => {
        if (!prev) return prev;
        const newFeoData = { ...prev.feoData!, [feoField]: value };
        
        // Auto-calculate paxTotal
        if (["paxKids", "paxTeacher", "paxParent", "paxComplimentary"].includes(feoField)) {
           newFeoData.paxTotal = (Number(newFeoData.paxKids) || 0) + (Number(newFeoData.paxTeacher) || 0) + (Number(newFeoData.paxParent) || 0) + (Number(newFeoData.paxComplimentary) || 0);
        }

        // Auto-calculate additional charge total
        if (["additionalChargePax", "additionalChargePrice"].includes(feoField)) {
           newFeoData.additionalChargeTotal = (Number(newFeoData.additionalChargePax) || 0) * (Number(newFeoData.additionalChargePrice) || 0);
           
           // Recalculate Grand Total
           const packageTotal = newFeoData.priceDetails?.reduce((sum, item) => sum + item.total, 0) || 0;
           newFeoData.grandTotal = packageTotal + newFeoData.additionalChargeTotal;
           newFeoData.balancePayment = newFeoData.grandTotal - (Number(newFeoData.downPayment) || 0);
        }

        // Auto-calculate balance payment
        if (feoField === "downPayment") {
           newFeoData.balancePayment = Number(newFeoData.grandTotal) - (Number(value) || 0);
        }

        return { ...prev, feoData: newFeoData };
      });
    } else {
      setFormData(prev => prev ? ({ ...prev, [field]: value }) : prev);
    }
  };

  const handleNumberChange = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/^0+(?=\d)/, '');
    if (e.target.value !== val) {
      e.target.value = val;
    }
    handleChange(field, val === "" ? 0 : Number(val));
  };

  const handlePriceDetailChange = (index: number, field: string, value: any) => {
    if (!formData) return;
    const newDetails = [...(formData.feoData?.priceDetails || [])];
    newDetails[index] = { ...newDetails[index], [field]: value };
    
    if (field === 'pax' || field === 'price') {
       newDetails[index].total = (Number(newDetails[index].pax) || 0) * (Number(newDetails[index].price) || 0);
    }
    
    const packageTotal = newDetails.reduce((sum, item) => sum + item.total, 0);
    const grandTotal = packageTotal + Number(formData.feoData?.additionalChargeTotal || 0);
    
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        feoData: {
          ...prev.feoData!,
          priceDetails: newDetails,
          grandTotal: grandTotal,
          balancePayment: grandTotal - Number(prev.feoData?.downPayment || 0)
        }
      }
    });
  };

  const handlePriceNumberChange = (index: number, field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/^0+(?=\d)/, '');
    if (e.target.value !== val) {
      e.target.value = val;
    }
    handlePriceDetailChange(index, field, val === "" ? 0 : Number(val));
  };

  const handleCurrencyChange = (field: string, val: string) => {
    const numericValue = Number(val.replace(/\D/g, ''));
    handleChange(field, numericValue);
  };

  const handlePriceCurrencyChange = (index: number, field: string, val: string) => {
    const numericValue = Number(val.replace(/\D/g, ''));
    handlePriceDetailChange(index, field, numericValue);
  };

  const addPriceDetailRow = () => {
    if (!formData) return;
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        feoData: {
          ...prev.feoData!,
          priceDetails: [...(prev.feoData?.priceDetails || []), { packageName: "", pax: 0, price: 0, total: 0 }]
        }
      }
    });
  };

  const removePriceDetailRow = (index: number) => {
    if (!formData) return;
    const newDetails = (formData.feoData?.priceDetails || []).filter((_, i) => i !== index);
    const packageTotal = newDetails.reduce((sum, item) => sum + item.total, 0);
    const grandTotal = packageTotal + Number(formData.feoData?.additionalChargeTotal || 0);
    
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        feoData: {
          ...prev.feoData!,
          priceDetails: newDetails,
          grandTotal: grandTotal,
          balancePayment: grandTotal - Number(prev.feoData?.downPayment || 0)
        }
      }
    });
  };

  const checkClash = async () => {
    try {
      const eventsRef = collection(db, "events");
      const q = query(eventsRef, where("startDate", "==", formData?.startDate));
      const snapshot = await getDocs(q);

      const isClashing = snapshot.docs.some(docSnap => {
        // Abaikan diri sendiri
        if (docSnap.id === formData?.id) return false;
        
        const data = docSnap.data() as AppEvent;
        if (data.status === "cancelled" || data.status === "rejected") return false;
        
        let isSameLocation = false;

        // Cek jika acara lain adalah REO
        if (data.type === "REO" && data.reoData) {
          const isSameRestaurant = data.reoData.restaurantName === formData?.feoData?.restaurantName;
          const isSameSection = data.reoData.venueSection === formData?.feoData?.lunchArea;
          if (isSameRestaurant && isSameSection) isSameLocation = true;
        }
        
        // Cek jika acara lain adalah FEO
        if (data.type === "FEO" && data.feoData) {
          const isSameRestaurant = data.feoData.restaurantName === formData?.feoData?.restaurantName;
          const isSameSection = data.feoData.lunchArea === formData?.feoData?.lunchArea;
          if (isSameRestaurant && isSameSection) isSameLocation = true;
        }

        if (isSameLocation) {
          const newStart = parseInt(formData?.startTime?.replace(":", "") || "0");
          const newEnd = parseInt(formData?.endTime?.replace(":", "") || "0");
          const existingStart = parseInt(data.startTime?.replace(":", "") || "0");
          const existingEnd = parseInt(data.endTime?.replace(":", "") || "0");

          return (newStart < existingEnd && newEnd > existingStart);
        }
        return false;
      });

      return isClashing;
    } catch (error) {
      console.error("Error checking clash:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !params.id) return;

    try {
      setLoading(true);
      setErrorMsg("");

      if (selectedApprovers.length === 0) {
        setErrorMsg("Harap pilih minimal 1 Approver.");
        toast.error("Pilih minimal 1 Approver");
        setLoading(false);
        return;
      }

      if (formData.feoData?.lunchArea) {
         const isClashing = await checkClash();
         if (isClashing) {
           setErrorMsg(`Jadwal BENTROK! Sudah ada event lain di ${formData.feoData?.restaurantName} (${formData.feoData?.lunchArea}) pada jam tersebut.`);
           toast.error("Jadwal bentrok!");
           setLoading(false);
           return;
         }
      }

      const approvalFlow = selectedApprovers.map((approver) => ({
        approverUid: approver.uid,
        approverName: approver.name,
        approverRole: approver.role || "Staff",
        actionType: approver.actionType || "Menyetujui",
        status: "WAITING",
        signatureUrl: null,
        approvedAt: null,
        note: null,
      }));

      const updateData = {
        ...formData,
        clientName: formData.feoData?.schoolName || formData.clientName,
        updatedAt: serverTimestamp(),
        approvalFlow,
        currentApproverIndex: 0,
      };

      await updateDoc(doc(db, "events", params.id as string), updateData);
      toast.success("FEO Berhasil Diubah");
      router.push(`/events/feo/${params.id}`);
    } catch (error: any) {
      setErrorMsg(error.message);
      toast.error("Gagal mengubah FEO");
    } finally {
      setLoading(false);
    }
  };

  const restaurantOptions = ["HWAMEI", "VULTURE'S NEST"];
  const hwameiSections = ["Section A", "Section B", "Section C", "Section D", "Section E"];
  const vultureSections = ["Section A", "Section B", "Section C"];

  const getSectionOptions = () => {
    return formData?.feoData?.restaurantName === "HWAMEI" ? hwameiSections : vultureSections;
  };

  if (initialLoading) return <LoadingScreen message="Memuat Form Edit FEO..." />;
  if (!formData) return <div className="p-8 text-center">FEO tidak ditemukan atau tidak memiliki akses.</div>;

  return (
    <ProtectedRoute requiredFeature="manage_feo">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Ubah Fieldtrip Event Order (FEO)</h1>
          <p className="text-slate-500 mt-1">Lakukan perubahan pada form FEO berikut.</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl shadow-sm">
            <p className="text-sm font-medium text-red-800">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. General Info & Pax */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">1</span>
                Informasi Grup & Pax
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Sekolah / Grup *</label>
                  <input type="text" required value={formData.feoData?.schoolName || ""} onChange={(e) => handleChange("feo.schoolName", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Judul Event (Utama) *</label>
                  <input type="text" required value={formData.title || ""} onChange={(e) => handleChange("title", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Person Incharge (PIC) *</label>
                  <input type="text" required value={formData.feoData?.personIncharge || ""} onChange={(e) => handleChange("feo.personIncharge", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Mobile No *</label>
                  <input type="text" required value={formData.feoData?.mobileNo || ""} onChange={(e) => handleChange("feo.mobileNo", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Address</label>
                  <textarea value={formData.feoData?.address || ""} onChange={(e) => handleChange("feo.address", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Rincian Peserta (Pax)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kids/Student</label>
                    <input type="number" value={formData.feoData?.paxKids === 0 ? "" : formData.feoData?.paxKids} onChange={(e) => handleNumberChange("feo.paxKids", e)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teacher</label>
                    <input type="number" value={formData.feoData?.paxTeacher === 0 ? "" : formData.feoData?.paxTeacher} onChange={(e) => handleNumberChange("feo.paxTeacher", e)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Parent/Companion</label>
                    <input type="number" value={formData.feoData?.paxParent === 0 ? "" : formData.feoData?.paxParent} onChange={(e) => handleNumberChange("feo.paxParent", e)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Complimentary</label>
                    <input type="number" value={formData.feoData?.paxComplimentary === 0 ? "" : formData.feoData?.paxComplimentary} onChange={(e) => handleNumberChange("feo.paxComplimentary", e)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-700 mb-1">Total Pax</label>
                    <input type="number" readOnly value={formData.feoData?.paxTotal || 0} className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm font-bold" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Venue & Date */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">2</span>
                Jadwal & Area Makan Siang
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 whitespace-nowrap">Tanggal Fieldtrip *</label>
                    <input type="date" required value={formData.startDate || ""} onChange={(e) => handleChange("startDate", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 whitespace-nowrap">Waktu Mulai</label>
                    <input type="time" value={formData.startTime || ""} onChange={(e) => handleChange("startTime", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 whitespace-nowrap">Waktu Selesai</label>
                    <input type="time" value={formData.endTime || ""} onChange={(e) => handleChange("endTime", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Restoran *</label>
                  <select value={formData.feoData?.restaurantName || ""} onChange={(e) => { handleChange("feo.restaurantName", e.target.value); handleChange("feo.lunchArea", ""); }} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none">
                    {restaurantOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Lunch Area (Venue Section) *</label>
                  <select value={formData.feoData?.lunchArea || ""} onChange={(e) => handleChange("feo.lunchArea", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none">
                    <option value="" disabled>Pilih Section Area</option>
                    {getSectionOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <p className="text-xs text-slate-500 mt-2 italic">*Sistem otomatis mengecek bentrok dengan REO/FEO lain di Area & Jam ini.</p>
                </div>
              </div>
            </div>

            {/* 3. Merch & Remarks */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">3</span>
                Merch & Remarks
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">No. of Bucket Hat</label>
                    <input type="number" value={formData.feoData?.bucketHatCount === 0 ? "" : formData.feoData?.bucketHatCount} onChange={(e) => handleNumberChange("feo.bucketHatCount", e)} placeholder="0" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">No. of Souvenir</label>
                    <input type="number" value={formData.feoData?.souvenirCount === 0 ? "" : formData.feoData?.souvenirCount} onChange={(e) => handleNumberChange("feo.souvenirCount", e)} placeholder="0" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Remarks</label>
                  <textarea value={formData.feoData?.remarks || ""} onChange={(e) => handleChange("feo.remarks", e.target.value)} rows={3} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Sales Incharge *</label>
                  <input type="text" required value={formData.feoData?.salesIncharge || ""} onChange={(e) => handleChange("feo.salesIncharge", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                </div>
              </div>
            </div>

            {/* 4. Price Details */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">4</span>
                Price Details
              </h2>
              
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-sm">
                      <th className="p-3 text-left rounded-tl-xl border border-slate-200">Package</th>
                      <th className="p-3 text-left border border-slate-200 w-24">Number of Pax</th>
                      <th className="p-3 text-left border border-slate-200 w-40">Price</th>
                      <th className="p-3 text-left border border-slate-200 w-48">Total</th>
                      <th className="p-3 text-center rounded-tr-xl border border-slate-200 w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.feoData?.priceDetails?.map((detail, index) => (
                      <tr key={index}>
                        <td className="p-2 border border-slate-200"><input type="text" value={detail.packageName} onChange={(e) => handlePriceDetailChange(index, 'packageName', e.target.value)} className="w-full p-2 border rounded-lg text-sm" /></td>
                        <td className="p-2 border border-slate-200"><input type="number" value={detail.pax === 0 ? "" : detail.pax} onChange={(e) => handlePriceNumberChange(index, 'pax', e)} placeholder="0" className="w-full p-2 border rounded-lg text-sm" /></td>
                        <td className="p-2 border border-slate-200"><input type="text" value={detail.price === 0 ? "" : detail.price.toLocaleString('id-ID')} onChange={(e) => handlePriceCurrencyChange(index, 'price', e.target.value)} placeholder="0" className="w-full p-2 border rounded-lg text-sm" /></td>
                        <td className="p-2 border border-slate-200"><input type="text" readOnly value={detail.total.toLocaleString('id-ID')} className="w-full p-2 border bg-slate-50 rounded-lg text-sm font-bold" /></td>
                        <td className="p-2 border border-slate-200 text-center">
                          <button type="button" onClick={() => removePriceDetailRow(index)} className="text-red-500 hover:text-red-700 p-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="p-2 border border-slate-200 text-center">
                        <button type="button" onClick={addPriceDetailRow} className="text-emerald-600 hover:text-emerald-700 font-bold text-sm flex items-center justify-center gap-2 w-full p-2">
                          + Tambah Baris Paket
                        </button>
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-2 border border-slate-200 font-bold text-sm text-right">ADDITIONAL CHARGE:</td>
                      <td className="p-2 border border-slate-200"><input type="number" value={formData.feoData?.additionalChargePax === 0 ? "" : formData.feoData?.additionalChargePax} onChange={(e) => handleNumberChange("feo.additionalChargePax", e)} className="w-full p-2 border rounded-lg text-sm" placeholder="Pax" /></td>
                      <td className="p-2 border border-slate-200"><input type="text" value={formData.feoData?.additionalChargePrice === 0 ? "" : formData.feoData?.additionalChargePrice.toLocaleString('id-ID')} onChange={(e) => handleCurrencyChange("feo.additionalChargePrice", e.target.value)} className="w-full p-2 border rounded-lg text-sm" placeholder="Price" /></td>
                      <td className="p-2 border border-slate-200"><input type="text" readOnly value={(formData.feoData?.additionalChargeTotal || 0).toLocaleString('id-ID')} className="w-full p-2 border bg-slate-100 rounded-lg text-sm font-bold" /></td>
                      <td className="p-2 border border-slate-200">
                         <input type="text" value={formData.feoData?.additionalChargeName || ""} onChange={(e) => handleChange("feo.additionalChargeName", e.target.value)} className="w-full p-2 border rounded-lg text-xs" placeholder="Name" />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-3 border border-slate-200 text-right font-bold text-lg">GRAND TOTAL</td>
                      <td colSpan={2} className="p-3 border border-slate-200 text-emerald-700 font-black text-lg">Rp {(formData.feoData?.grandTotal || 0).toLocaleString('id-ID')}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-3 border border-slate-200 text-right font-bold">DOWN PAYMENT</td>
                      <td colSpan={2} className="p-3 border border-slate-200"><input type="text" value={formData.feoData?.downPayment === 0 ? "" : formData.feoData?.downPayment.toLocaleString('id-ID')} onChange={(e) => handleCurrencyChange("feo.downPayment", e.target.value)} placeholder="0" className="w-full p-2 border rounded-lg font-bold" /></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-3 border border-slate-200 text-right font-bold text-orange-600">BALANCE PAYMENT</td>
                      <td colSpan={2} className="p-3 border border-slate-200 text-orange-600 font-black text-lg">Rp {(formData.feoData?.balancePayment || 0).toLocaleString('id-ID')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Rundown & Meal Box */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">5</span>
                Rundown & Meal Box
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Zona / Morning Tour</label>
                    <textarea value={formData.feoData?.zonaMorningTour || ""} onChange={(e) => handleChange("feo.zonaMorningTour", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Half zone + lunch</label>
                    <textarea value={formData.feoData?.lunchArea || ""} onChange={(e) => handleChange("feo.lunchArea", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Driver Meal Box / Notes</label>
                    <textarea value={formData.feoData?.driver || ""} onChange={(e) => handleChange("feo.driver", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </div>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-2">Meal Box Details</h3>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Kids Meal Box Menu</label>
                      <input type="text" value={formData.feoData?.mealBoxKids || ""} onChange={(e) => handleChange("feo.mealBoxKids", e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Pax</label>
                      <input type="number" value={formData.feoData?.mealBoxKidsPax === 0 ? "" : formData.feoData?.mealBoxKidsPax} onChange={(e) => handleNumberChange("feo.mealBoxKidsPax", e)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Teacher Meal Box Menu</label>
                      <input type="text" value={formData.feoData?.mealBoxTeacher || ""} onChange={(e) => handleChange("feo.mealBoxTeacher", e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Pax</label>
                      <input type="number" value={formData.feoData?.mealBoxTeacherPax === 0 ? "" : formData.feoData?.mealBoxTeacherPax} onChange={(e) => handleNumberChange("feo.mealBoxTeacherPax", e)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Department Notes */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">6</span>
                Department Notes
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currator / Wildlife</label>
                  <textarea value={formData.feoData?.notesCurator || ""} onChange={(e) => handleChange("feo.notesCurator", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ticketing</label>
                  <textarea value={formData.feoData?.notesTicketing || ""} onChange={(e) => handleChange("feo.notesTicketing", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">FB Kitchen</label>
                  <textarea value={formData.feoData?.notesFBKitchen || ""} onChange={(e) => handleChange("feo.notesFBKitchen", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">FB Service</label>
                  <textarea value={formData.feoData?.notesFBService || ""} onChange={(e) => handleChange("feo.notesFBService", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Housekeeping / Wahana</label>
                  <textarea value={formData.feoData?.notesHousekeeping || ""} onChange={(e) => handleChange("feo.notesHousekeeping", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Security</label>
                  <textarea value={formData.feoData?.notesSecurity || ""} onChange={(e) => handleChange("feo.notesSecurity", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sales & Marketing</label>
                  <textarea value={formData.feoData?.notesSalesMarketing || ""} onChange={(e) => handleChange("feo.notesSalesMarketing", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              </div>
            </div>

            {/* 7. Approval Flow */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">7</span>
                Alur Persetujuan (Approval Flow)
              </h2>
              <p className="text-sm text-slate-500 mb-6">Pilih siapa saja yang harus menyetujui dokumen FEO ini secara BERURUTAN.</p>
              
              <div className="mb-4">
                <select 
                  onChange={handleAddApprover}
                  className="w-full md:w-1/2 border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>+ Tambahkan Approver Baru</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              {/* List of Approvers */}
              <div className="space-y-3">
                {selectedApprovers.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-sm bg-slate-50">
                    Belum ada approver yang dipilih. Silakan tambah di atas.
                  </div>
                ) : (
                  selectedApprovers.map((approver, index) => (
                    <div key={approver.uid} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                      <div className="flex flex-row sm:flex-col items-center justify-center gap-1 sm:mr-2">
                        <button type="button" onClick={() => moveApprover(index, 'up')} disabled={index === 0} className="text-slate-400 hover:text-emerald-600 disabled:opacity-30">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <span className="text-xs font-bold text-slate-400 w-4 text-center">{index + 1}</span>
                        <button type="button" onClick={() => moveApprover(index, 'down')} disabled={index === selectedApprovers.length - 1} className="text-slate-400 hover:text-emerald-600 disabled:opacity-30">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                      
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{approver.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{approver.role}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <select
                          value={approver.actionType}
                          onChange={(e) => updateApproverAction(index, e.target.value)}
                          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none w-full sm:w-auto"
                        >
                          <option value="Mengetahui">Diketahui Oleh</option>
                          <option value="Menyetujui">Disetujui / Dicek Oleh</option>
                        </select>
                        
                        <button 
                          type="button" 
                          onClick={() => handleRemoveApprover(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-4 mt-8">
            <button type="button" onClick={() => router.back()} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading} className="px-8 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50">
              {loading ? "Menyimpan..." : "Simpan Perubahan FEO"}
            </button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}
