"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { collection, updateDoc, serverTimestamp, query, getDocs, getDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppEvent, REOData } from "@/types/event";
import toast from "react-hot-toast";

export default function EditREOPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [users, setUsers] = useState<any[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<any[]>([]);

  const [formData, setFormData] = useState<AppEvent>({
    title: "",
    clientName: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    startTime: "10:00",
    endTime: "14:00",
    type: "REO",
    status: "draft",
    reoData: {
      guestName: "",
      companyName: "",
      address: "",
      venueSection: "Section A",
      eventType: "",
      typeOfEvent: "",
      timeOfEvent: "",
      setupLayout: "",
      pax: 0,
      package: "",
      price: 0,
      corkage: "",
      equipmentNeeded: "",
      salesIncharge: "",
      fbIncharge: "",
      remarks: "",
      restaurantName: "HWAMEI",
      priceDetails: [{ packageName: "", pax: 0, price: 0, total: 0 }],
      grandTotal: 0,
      downPayment: 0,
      balancePayment: 0,
      buffetReadyJam: "",
      overHandle: "",
      appetizer: "",
      soup: "",
      mainCourse: "",
      sideDish: "",
      dessert: "",
      beverage: "",
      restaurantArrangement: "",
      billingInstruction: "PLEASE ENTER ALL EVENT REVENUE + ALL ALA CARTE WHEN THE EVENT TAKES PLACE, WITH A NOTE: EVENT NAME/GUEST NAME\n- Please For All Bill Alacarte Directly Closed Bill\n- Please Write The Name Of The Pic Event",
      engineering: "",
      finance: "",
      it: "",
      security: "",
      housekeeping: "",
      salesMarketing: "",
      otherDepartment: "",
      preparedBy: user?.name || "",
      approvedBy: "",
    } as REOData
  });

  useEffect(() => {
    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (id && user) {
      fetchEventData();
    }
  }, [id, user]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("name"));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })).filter(u => u.uid !== user?.uid);
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchEventData = async () => {
    try {
      const docRef = doc(db, "events", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as AppEvent;
        
        // Security check
        if ((data.status !== "draft" && data.status !== "negotiation" && data.status !== "rejected") ||
            (data.createdBy !== user?.uid && user?.role !== "super_admin")) {
           toast.error("Anda tidak memiliki hak akses untuk mengedit dokumen ini.");
           router.push(`/events/reo/${id}`);
           return;
        }

        if (!data.reoData) {
            toast.error("Format data REO tidak valid.");
            router.push(`/events/reo/${id}`);
            return;
        }

        // Fill missing arrays
        if (!data.reoData.priceDetails) data.reoData.priceDetails = [];

        setFormData(data);
        if (data.approvalFlow) {
           setSelectedApprovers(data.approvalFlow.map(a => ({
             uid: a.approverUid,
             name: a.approverName,
             role: a.approverRole,
             actionType: a.actionType || "Menyetujui",
             status: a.status,
             signatureUrl: a.signatureUrl,
             approvedAt: a.approvedAt
           })));
        }
      } else {
        toast.error("Data REO tidak ditemukan");
        router.push("/events/reo");
      }
    } catch (err) {
       console.error(err);
       toast.error("Gagal mengambil data");
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
    if (field.startsWith("reo.")) {
      const reoField = field.split(".")[1];
      setFormData(prev => ({
        ...prev,
        reoData: {
          ...prev.reoData!,
          [reoField]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleNumberChange = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/^0+(?=\d)/, '');
    if (e.target.value !== val) {
      e.target.value = val;
    }
    handleChange(field, val === "" ? 0 : Number(val));
  };

  const handleCurrencyChange = (field: string, val: string) => {
    const numericValue = Number(val.replace(/\D/g, ''));
    handleChange(field, numericValue);
  };

  const handlePriceCurrencyChange = (index: number, field: string, val: string) => {
    const numericValue = Number(val.replace(/\D/g, ''));
    handlePriceDetailChange(index, field, numericValue);
  };

  const handlePriceDetailChange = (index: number, field: string, value: any) => {
    const newDetails = [...formData.reoData!.priceDetails];
    newDetails[index] = { ...newDetails[index], [field]: value };
    
    if (field === 'pax' || field === 'price') {
       newDetails[index].total = (Number(newDetails[index].pax) || 0) * (Number(newDetails[index].price) || 0);
    }
    
    const grandTotal = newDetails.reduce((sum, item) => sum + item.total, 0);
    
    setFormData(prev => ({
      ...prev,
      reoData: {
        ...prev.reoData!,
        priceDetails: newDetails,
        grandTotal: grandTotal,
        balancePayment: grandTotal - prev.reoData!.downPayment
      }
    }));
  };

  const handlePriceNumberChange = (index: number, field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/^0+(?=\d)/, '');
    if (e.target.value !== val) {
      e.target.value = val;
    }
    handlePriceDetailChange(index, field, val === "" ? 0 : Number(val));
  };

  const addPriceDetailRow = () => {
    setFormData(prev => ({
      ...prev,
      reoData: {
        ...prev.reoData!,
        priceDetails: [...prev.reoData!.priceDetails, { packageName: "", pax: 0, price: 0, total: 0 }]
      }
    }));
  };

  const removePriceDetailRow = (index: number) => {
    const newDetails = formData.reoData!.priceDetails.filter((_, i) => i !== index);
    const grandTotal = newDetails.reduce((sum, item) => sum + item.total, 0);
    
    setFormData(prev => ({
      ...prev,
      reoData: {
        ...prev.reoData!,
        priceDetails: newDetails,
        grandTotal: grandTotal,
        balancePayment: grandTotal - prev.reoData!.downPayment
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.startDate) {
      toast.error("Nama Event dan Tanggal wajib diisi!");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");

      if (selectedApprovers.length === 0) {
        setErrorMsg("Harap pilih minimal 1 Approver.");
        toast.error("Pilih minimal 1 Approver");
        setLoading(false);
        return;
      }

      // We skip checkClash on edit to simplify, or you can implement it with an ignore self-id logic.
      // For now, let's allow saving the edit without hard clashing check.

      const approvalFlow = selectedApprovers.map((approver) => ({
        approverUid: approver.uid,
        approverName: approver.name,
        approverRole: approver.role || "Staff",
        actionType: approver.actionType || "Menyetujui",
        status: approver.status || "WAITING",
        signatureUrl: approver.signatureUrl || null,
        approvedAt: approver.approvedAt || null,
      }));

      // Kita buang atribut `id` dari payload karena id hanya key di document.
      const payloadData = { ...formData };
      delete (payloadData as any).id;

      const docData = {
        ...payloadData,
        clientName: formData.reoData?.guestName || formData.clientName,
        updatedAt: serverTimestamp(),
        approvalFlow,
        // we preserve currentApproverIndex from previous, or reset to 0 if flow changed? 
        // to be safe, if status is draft, keep it at 0.
        currentApproverIndex: formData.status === 'draft' ? 0 : formData.currentApproverIndex,
      };

      await updateDoc(doc(db, "events", id), docData);
      toast.success("REO berhasil diperbarui!");
      router.push(`/events/reo/${id}`);
    } catch (error: any) {
      console.error("Error updating REO:", error);
      toast.error("Gagal menyimpan REO: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredFeature="manage_reo">
      <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-200">{errorMsg}</div>}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Edit REO</h1>
            <p className="text-slate-500 mt-1">Perbarui formulir Restaurant Event Order</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors w-full sm:w-auto text-center"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 w-full sm:w-auto text-center"
            >
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">1</span>
                Informasi Umum
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Event (Sistem) *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tanggal Event *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => {
                      handleChange("startDate", e.target.value);
                      handleChange("endDate", e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Jam Mulai *</label>
                    <input type="time" required value={formData.startTime} onChange={(e) => handleChange("startTime", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Jam Selesai *</label>
                    <input type="time" required value={formData.endTime} onChange={(e) => handleChange("endTime", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Restoran *</label>
                  <select 
                    value={formData.reoData?.restaurantName} 
                    onChange={(e) => handleChange("reo.restaurantName", e.target.value)} 
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500 font-bold text-slate-800"
                  >
                    <option value="HWAMEI">HWAMEI</option>
                    <option value="VULTURE'S NEST">VULTURE'S NEST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Event Type</label>
                  <input type="text" value={formData.reoData?.eventType} onChange={(e) => handleChange("reo.eventType", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Guest Name</label>
                  <input type="text" value={formData.reoData?.guestName} onChange={(e) => handleChange("reo.guestName", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Company Name</label>
                  <input type="text" value={formData.reoData?.companyName} onChange={(e) => handleChange("reo.companyName", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Type Of Event</label>
                  <input type="text" value={formData.reoData?.typeOfEvent} onChange={(e) => handleChange("reo.typeOfEvent", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Venue / Section</label>
                  <select 
                    value={formData.reoData?.venueSection} 
                    onChange={(e) => handleChange("reo.venueSection", e.target.value)} 
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5"
                  >
                    {formData.reoData?.restaurantName === "HWAMEI" ? (
                      <>
                        <option value="Section A">Section A</option>
                        <option value="Section B">Section B</option>
                        <option value="Section C">Section C</option>
                        <option value="Section D">Section D</option>
                        <option value="Section E">Section E</option>
                      </>
                    ) : (
                      <>
                        <option value="Section A">Section A</option>
                        <option value="Section B">Section B</option>
                        <option value="Section C">Section C</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Set Up / Layout</label>
                  <input type="text" value={formData.reoData?.setupLayout} onChange={(e) => handleChange("reo.setupLayout", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">No. of Pax</label>
                  <input type="number" value={formData.reoData?.pax === 0 ? "" : formData.reoData?.pax} onChange={(e) => handleNumberChange("reo.pax", e)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Sales Incharge</label>
                  <input type="text" value={formData.reoData?.salesIncharge} onChange={(e) => handleChange("reo.salesIncharge", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">FB Incharge</label>
                  <input type="text" value={formData.reoData?.fbIncharge} onChange={(e) => handleChange("reo.fbIncharge", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">Remarks</label>
                <textarea value={formData.reoData?.remarks} onChange={(e) => handleChange("reo.remarks", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
              </div>
            </div>

            {/* Bagian 2: Kitchen / Food Arrangements */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">2</span>
                Kitchen / Food Arrangements
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Buffet Ready Jam</label>
                  <input type="text" value={formData.reoData?.buffetReadyJam} onChange={(e) => handleChange("reo.buffetReadyJam", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Over Handle</label>
                  <input type="text" value={formData.reoData?.overHandle} onChange={(e) => handleChange("reo.overHandle", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
              </div>
              
              <div className="mt-6 space-y-4">
                {['Appetizer', 'Soup', 'Main Course', 'Side Dish', 'Dessert', 'Beverage'].map((item) => {
                  const key = item.replace(/\s+/g, '').replace(/^[A-Z]/, c => c.toLowerCase());
                  return (
                    <div key={item} className="flex flex-col sm:flex-row gap-4">
                      <div className="sm:w-1/4 pt-2 font-bold text-red-600 bg-red-50 text-center rounded-lg">{item}</div>
                      <textarea 
                        value={(formData.reoData as any)[key]} 
                        onChange={(e) => handleChange(`reo.${key}`, e.target.value)} 
                        rows={2} 
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5" 
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bagian 3: Detail Price (Billing) */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">3</span>
                Detail Price
              </h2>
              
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-sm font-bold text-slate-600">PACKAGE</th>
                      <th className="p-3 text-sm font-bold text-slate-600 w-24">PAX</th>
                      <th className="p-3 text-sm font-bold text-slate-600 w-40">PRICE</th>
                      <th className="p-3 text-sm font-bold text-slate-600 w-40">TOTAL</th>
                      <th className="p-3 text-sm font-bold text-slate-600 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.reoData?.priceDetails?.map((detail, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="p-2"><input type="text" value={detail.packageName} onChange={(e) => handlePriceDetailChange(idx, 'packageName', e.target.value)} className="w-full p-2 border border-slate-200 rounded" /></td>
                        <td className="p-2"><input type="number" value={detail.pax === 0 ? "" : detail.pax} onChange={(e) => handlePriceNumberChange(idx, 'pax', e)} className="w-full p-2 border border-slate-200 rounded" /></td>
                        <td className="p-2">
                          <div className="flex items-center">
                            <span className="text-slate-500 mr-2">Rp</span>
                            <input type="text" value={detail.price === 0 ? "" : detail.price.toLocaleString('id-ID')} onChange={(e) => handlePriceCurrencyChange(idx, 'price', e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                          </div>
                        </td>
                        <td className="p-2 font-bold text-slate-700">Rp {detail.total.toLocaleString('id-ID')}</td>
                        <td className="p-2 text-center">
                          {formData.reoData!.priceDetails.length > 1 && (
                            <button type="button" onClick={() => removePriceDetailRow(idx)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-lg" title="Hapus Baris">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mb-6">
                <button type="button" onClick={addPriceDetailRow} className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Tambah Baris Paket/Item
                </button>
              </div>
              
              <div className="space-y-3 w-full sm:w-1/2 ml-auto">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                  <span className="font-bold text-slate-700">GRAND TOTAL:</span>
                  <span className="font-bold text-emerald-600 text-lg">Rp {formData.reoData?.grandTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center px-3">
                  <span className="font-bold text-slate-700">DOWN PAYMENT:</span>
                  <div className="flex items-center w-1/2">
                     <span className="text-slate-500 mr-3">Rp</span>
                     <input type="text" value={formData.reoData?.downPayment === 0 ? "" : formData.reoData?.downPayment.toLocaleString('id-ID')} onChange={(e) => handleCurrencyChange("reo.downPayment", e.target.value)} className="w-full text-right p-2 border border-emerald-500 focus:ring-emerald-500 rounded-lg outline-none" placeholder="0" />
                  </div>
                </div>
                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg">
                  <span className="font-bold text-slate-700">BALANCE PAYMENT:</span>
                  <span className="font-bold text-orange-600 text-lg">Rp {formData.reoData?.balancePayment.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
            
            {/* Bagian Approval */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">5</span>
                Alur Persetujuan (Approval Flow)
              </h2>
              <p className="text-sm text-slate-500 mb-6">Pilih siapa saja yang harus menyetujui dokumen REO ini secara BERURUTAN.</p>
              
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
                          <option value="Menyetujui">Disetujui Oleh</option>
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

          {/* Kolom Kanan - Koordinasi Departemen */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">4</span>
                Set Up & Arrangement
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    {formData.reoData?.restaurantName || "HWAMEI"} Arrangements
                  </label>
                  <textarea value={formData.reoData?.restaurantArrangement} onChange={(e) => handleChange("reo.restaurantArrangement", e.target.value)} rows={3} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Billing Instruction to Cashier</label>
                  <textarea value={formData.reoData?.billingInstruction} onChange={(e) => handleChange("reo.billingInstruction", e.target.value)} rows={5} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Engineering</label>
                  <textarea value={formData.reoData?.engineering} onChange={(e) => handleChange("reo.engineering", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Finance</label>
                  <input type="text" value={formData.reoData?.finance} onChange={(e) => handleChange("reo.finance", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">IT</label>
                  <input type="text" value={formData.reoData?.it} onChange={(e) => handleChange("reo.it", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Security</label>
                  <input type="text" value={formData.reoData?.security} onChange={(e) => handleChange("reo.security", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">House Keeping Team</label>
                  <input type="text" value={formData.reoData?.housekeeping} onChange={(e) => handleChange("reo.housekeeping", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Sales & Marketing Team</label>
                  <input type="text" value={formData.reoData?.salesMarketing} onChange={(e) => handleChange("reo.salesMarketing", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Other Department</label>
                  <input type="text" value={formData.reoData?.otherDepartment} onChange={(e) => handleChange("reo.otherDepartment", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5" />
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-200">
                 <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Prepared By</label>
                      <input type="text" value={formData.reoData?.preparedBy} onChange={(e) => handleChange("reo.preparedBy", e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 font-semibold" />
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </ProtectedRoute>
  );
}
