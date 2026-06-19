"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { AppEvent } from "@/types/event";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/ui/LoadingScreen";
import TransparentSignature from "@/components/ui/TransparentSignature";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function REODetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [event, setEvent] = useState<AppEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; type: "APPROVE" | "REJECT" | null }>({ isOpen: false, type: null });
  const [actionNote, setActionNote] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        if (!params.id) return;
        const docRef = doc(db, "events", params.id as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setEvent({ id: docSnap.id, ...docSnap.data() } as AppEvent);
        } else {
          console.error("No such document!");
        }
      } catch (error) {
        console.error("Error fetching REO:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCurrentUser = async () => {
      if (!user?.uid) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setCurrentUserData(userDoc.data());
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchEvent();
    fetchCurrentUser();
  }, [params.id, user]);

  const isCurrentApprover = () => {
    if (!event || event.status !== "waiting_approval" || !user) return false;
    const currentApprover = event.approvalFlow?.[event.currentApproverIndex || 0];
    return currentApprover?.approverUid === user.uid;
  };

  const openActionModal = (type: "APPROVE" | "REJECT") => {
    if (type === "APPROVE" && !currentUserData?.signatureUrl) {
      alert("⚠️ Anda belum memiliki Tanda Tangan Digital. Silakan atur di Profil terlebih dahulu.");
      return;
    }
    setActionModal({ isOpen: true, type });
    setActionNote("");
  };

  const submitAction = async () => {
    if (actionModal.type === "REJECT" && !actionNote.trim()) {
      alert("⚠️ Catatan penolakan wajib diisi!");
      return;
    }

    setIsProcessing(true);
    try {
      const flow = [...(event?.approvalFlow || [])];
      const idx = event?.currentApproverIndex || 0;
      
      if (actionModal.type === "APPROVE") {
        flow[idx].status = "APPROVED";
        flow[idx].signatureUrl = currentUserData?.signatureUrl;
      } else {
        flow[idx].status = "REJECTED";
      }
      
      flow[idx].note = actionNote.trim();
      flow[idx].approvedAt = new Date().toISOString();

      const nextIdx = idx + 1;
      const isFullyApproved = nextIdx >= flow.length;
      
      const updateData: any = {
        approvalFlow: flow,
      };

      if (actionModal.type === "APPROVE") {
        updateData.currentApproverIndex = nextIdx;
        if (isFullyApproved) {
            updateData.status = "approved";
        } else {
            updateData.status = "waiting_approval";
        }
      } else {
        updateData.status = "rejected";
      }

      await updateDoc(doc(db, "events", event!.id!), updateData);
      
      setEvent(prev => ({
          ...prev!,
          ...updateData
      }));
      
      setActionModal({ isOpen: false, type: null });
    } catch (error) {
      console.error("Error processing action:", error);
      alert("❌ Terjadi kesalahan saat memproses aksi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitForApproval = async () => {
    if (!confirm("Kirim dokumen ini untuk persetujuan? Anda tidak bisa mengeditnya lagi setelah dikirim.")) return;
    setIsProcessing(true);
    try {
      const resetFlow = event?.approvalFlow?.map(a => ({
        ...a,
        status: "WAITING" as const,
        signatureUrl: null,
        approvedAt: null,
        note: ""
      })) || [];

      const updateData = { 
        status: "waiting_approval" as const,
        currentApproverIndex: 0,
        approvalFlow: resetFlow
      };
      await updateDoc(doc(db, "events", event!.id!), updateData);
      setEvent(prev => ({ ...prev!, ...updateData }));
    } catch (error) {
      console.error("Error submitting for approval:", error);
      alert("❌ Gagal mengirim untuk persetujuan.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500);
  };

  if (loading) return <LoadingScreen message="Memuat REO..." />;
  if (!event || !event.reoData) return <div className="p-8 text-center">Data REO tidak ditemukan.</div>;

  const { reoData } = event;

  const getDocumentNumber = () => {
    let noStr = "0000";
    if (event?.documentNumber) {
      noStr = String(event.documentNumber).padStart(4, '0');
    } else if (event?.id) {
      noStr = event.id.substring(0, 4).toUpperCase();
    }
    
    let dateObj = new Date();
    if (event.createdAt) {
      if (typeof event.createdAt.toDate === 'function') {
        dateObj = event.createdAt.toDate();
      } else {
        dateObj = new Date(event.createdAt);
      }
    } else if (event.startDate) {
      dateObj = new Date(event.startDate);
    }
    
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
    
    const tgl = String(dateObj.getDate()).padStart(2, '0');
    const bln = String(dateObj.getMonth() + 1).padStart(2, '0');
    const th = String(dateObj.getFullYear());
    
    return `REO/${noStr}/${tgl}/${bln}/${th}`;
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "hr", "manager"]}>
      {/* Tombol Aksi - Disembunyikan saat print */}
      <div className={`w-full max-w-5xl mx-auto px-4 py-6 flex justify-between items-center ${isPrinting ? 'hidden' : 'block'}`}>
        <button onClick={() => router.back()} className="text-slate-500 hover:bg-slate-100 px-4 py-2 rounded-xl font-bold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Kembali
        </button>
        <div className="flex gap-3">
          {((event.createdBy === user?.uid || user?.role === 'super_admin') && (event.status === 'draft' || event.status === 'negotiation' || event.status === 'rejected')) && (
            <>
              <button onClick={() => router.push(`/events/reo/${event.id}/edit`)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit Dokumen
              </button>
              <button onClick={submitForApproval} disabled={isProcessing} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Minta Persetujuan
              </button>
            </>
          )}
          <button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Cetak REO
          </button>
        </div>
      </div>

      {/* Area Kertas Print */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #print-area { transform: scale(0.92); transform-origin: top center; }
        }
      `}</style>
      <div className={`w-full max-w-5xl mx-auto bg-white p-6 sm:p-10 print:p-0 text-[11px] text-slate-800 ${isPrinting ? 'shadow-none' : 'shadow-2xl rounded-sm mb-32 border border-slate-100'}`} id="print-area">
        
        {/* Header Kertas */}
        <div className="relative border-b border-slate-300 pb-4 print:pb-2 mb-6 print:mb-4 flex flex-col items-center">
             {/* Tempat Logo Restoran */}
             <div className="h-24 print:h-16 mb-4 flex items-center justify-center">
                {reoData.restaurantName === "VULTURE'S NEST" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src="/vultures_nest_logo.png" alt="Vulture's Nest Logo" className="max-h-full w-auto object-contain" />
                ) : (
                  <div className="w-32 h-16 print:w-24 print:h-12 border border-slate-200 bg-slate-50 rounded-sm flex items-center justify-center text-[10px] print:text-[8px] font-bold text-slate-400 text-center">
                    [LOGO<br/>{reoData.restaurantName || "RESTO"}]
                  </div>
                )}
             </div>
             
             <div className="text-center">
               <h1 className="text-2xl print:text-xl font-light tracking-[0.2em] text-slate-900">RESTAURANT EVENT ORDER</h1>
               <p className="text-slate-500 font-medium tracking-wide text-xs print:text-[10px] mt-1 uppercase">Official F&B Operational Document</p>
             </div>

             <div className="absolute top-0 right-0 text-right">
               <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Document No.</div>
               <div className="text-lg print:text-base font-medium text-slate-800 tracking-wider mb-2 print:mb-1">{getDocumentNumber()}</div>
               <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</div>
               <div className="text-xs print:text-[10px] font-bold text-slate-800 uppercase tracking-widest">{event.status}</div>
             </div>
        </div>

        {/* Tabel General Info */}
        <div className="border border-slate-200 rounded-sm overflow-hidden mb-6 print:mb-4">
          <table className="w-full text-left border-collapse">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 w-1/4 bg-slate-50">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Event Type</div>
                  <div className="font-medium text-slate-800">{reoData.eventType || "-"}</div>
                </td>
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 w-1/4">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Guest Name</div>
                  <div className="font-medium text-slate-800">{reoData.guestName || "-"}</div>
                </td>
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 w-1/4 bg-slate-50">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Company Name</div>
                  <div className="font-medium text-slate-800">{reoData.companyName || "-"}</div>
                </td>
                <td className="p-2.5 print:p-1.5 w-1/4">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Date Event</div>
                  <div className="font-medium text-slate-800">{format(new Date(event.startDate), "dd MMMM yyyy", { locale: localeId })}</div>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 bg-slate-50">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Venue / Section</div>
                  <div className="font-medium text-slate-800">{reoData.venueSection || "-"}</div>
                </td>
                <td className="border-r border-slate-200 p-2.5 print:p-1.5">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Time of Event</div>
                  <div className="font-medium text-slate-800">{reoData.timeOfEvent || "-"}</div>
                </td>
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 bg-slate-50">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Type of Event</div>
                  <div className="font-medium text-slate-800 italic">{reoData.typeOfEvent || "-"}</div>
                </td>
                <td className="p-2.5 print:p-1.5">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">No. of Pax</div>
                  <div className="font-medium text-slate-800">{reoData.pax} Pax</div>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 bg-slate-50">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Set Up / Layout</div>
                  <div className="font-medium text-slate-800">{reoData.setupLayout || "-"}</div>
                </td>
                <td className="border-r border-slate-200 p-2.5 print:p-1.5">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Address</div>
                  <div className="font-medium text-slate-800 whitespace-pre-wrap leading-tight">{reoData.address || "-"}</div>
                </td>
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 bg-slate-50">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Sales Incharge</div>
                  <div className="font-medium text-slate-800">{reoData.salesIncharge || "-"}</div>
                </td>
                <td className="p-2.5 print:p-1.5">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">FB Incharge</div>
                  <div className="font-medium text-slate-800">{reoData.fbIncharge || "-"}</div>
                </td>
              </tr>
              <tr>
                <td className="border-r border-slate-200 p-2.5 print:p-1.5 bg-slate-50">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Equipment Needed</div>
                  <div className="font-medium text-slate-800 whitespace-pre-wrap leading-tight">{reoData.equipmentNeeded || "-"}</div>
                </td>
                <td colSpan={3} className="p-2.5 print:p-1.5">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Remarks</div>
                  <div className="font-medium text-slate-800 whitespace-pre-wrap leading-tight">{reoData.remarks || "-"}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabel Price Details */}
        <div className="mb-6 print:mb-4">
          <h2 className="text-[10px] print:text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1.5">Financial Details</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="py-2 print:py-1 px-2 text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider w-1/2">Package Description</th>
                <th className="py-2 print:py-1 px-2 text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-24">Pax</th>
                <th className="py-2 print:py-1 px-2 text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider text-right w-32">Unit Price</th>
                <th className="py-2 print:py-1 px-2 text-[9px] print:text-[8px] font-bold text-slate-500 uppercase tracking-wider text-right w-40">Total</th>
              </tr>
            </thead>
            <tbody>
              {reoData.priceDetails?.map((detail, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-1.5 print:py-1 px-2 text-slate-800 font-medium">{detail.packageName || "-"}</td>
                  <td className="py-1.5 print:py-1 px-2 text-slate-600 text-center">{detail.pax}</td>
                  <td className="py-1.5 print:py-1 px-2 text-slate-600 text-right">Rp {detail.price.toLocaleString('id-ID')}</td>
                  <td className="py-1.5 print:py-1 px-2 text-slate-800 text-right font-medium">Rp {detail.total.toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300">
              <tr>
                <td colSpan={3} className="py-2 print:py-1 px-2 text-right text-[10px] print:text-[9px] font-bold text-slate-500 uppercase tracking-wider">Grand Total</td>
                <td className="py-2 print:py-1 px-2 text-right text-sm print:text-xs font-bold text-slate-900">Rp {reoData.grandTotal?.toLocaleString('id-ID')}</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-1 px-2 text-right text-[9px] print:text-[8px] font-medium text-slate-500 uppercase tracking-wider">Down Payment</td>
                <td className="py-1 px-2 text-right text-[11px] print:text-[10px] font-medium text-slate-700">Rp {reoData.downPayment?.toLocaleString('id-ID')}</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 print:py-1 px-2 text-right text-[10px] print:text-[9px] font-bold text-slate-800 uppercase tracking-wider bg-slate-50">Balance Payment</td>
                <td className="py-2 print:py-1 px-2 text-right text-sm print:text-xs font-bold text-slate-900 bg-slate-50">Rp {reoData.balancePayment?.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Tabel Kitchen & Dept */}
        <div className="grid grid-cols-2 gap-6 print:gap-4 mb-6 print:mb-2">
           {/* Kolom Kiri: Kitchen */}
           <div>
             <h2 className="text-[10px] print:text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1.5">Kitchen & Food Arrangements</h2>
             
             <div className="bg-slate-50 p-2.5 print:p-1.5 rounded-sm border border-slate-200 mb-2 flex justify-between">
                <div>
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">Buffet Ready</div>
                  <div className="font-medium text-slate-800">{reoData.buffetReadyJam || "-"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">Over Handle</div>
                  <div className="font-medium text-slate-800">{reoData.overHandle || "-"}</div>
                </div>
             </div>
             
             <div className="border border-slate-200 rounded-sm">
               {['Appetizer', 'Soup', 'Main Course', 'Side Dish', 'Dessert', 'Beverage'].map((item, idx) => {
                 const key = item.replace(/\s+/g, '').replace(/^[A-Z]/, c => c.toLowerCase());
                 return (
                   <div key={item} className={`flex ${idx !== 5 ? 'border-b border-slate-200' : ''}`}>
                     <div className="w-1/3 bg-slate-50 text-slate-500 text-[9px] print:text-[8px] font-bold uppercase tracking-wider p-2 print:p-1.5 flex items-center border-r border-slate-200">
                       {item}
                     </div>
                     <div className="w-2/3 p-2 print:p-1.5 text-[11px] print:text-[10px] text-slate-800 font-medium whitespace-pre-wrap leading-tight">
                       {(reoData as any)[key] || "-"}
                     </div>
                   </div>
                 )
               })}
             </div>
           </div>

           {/* Kolom Kanan: Departments */}
           <div>
             <h2 className="text-[10px] print:text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1.5">Set Up & Arrangements</h2>
             <div className="space-y-2.5 print:space-y-1.5">
               <div>
                 <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{reoData.restaurantName || "Venue"} Arrangements</div>
                 <div className="font-medium text-slate-800 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 py-0.5 leading-tight">{reoData.restaurantArrangement || "-"}</div>
               </div>
               <div>
                 <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Billing Instruction to Cashier</div>
                 <div className="font-medium text-slate-800 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 py-0.5 leading-tight">{reoData.billingInstruction || "-"}</div>
               </div>
               <div>
                 <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Engineering</div>
                 <div className="font-medium text-slate-800 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 py-0.5 leading-tight">{reoData.engineering || "-"}</div>
               </div>
               <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                 <div>
                   <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">Finance</div>
                   <div className="font-medium text-slate-800">{reoData.finance || "-"}</div>
                 </div>
                 <div>
                   <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">IT</div>
                   <div className="font-medium text-slate-800">{reoData.it || "-"}</div>
                 </div>
                 <div>
                   <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">Security</div>
                   <div className="font-medium text-slate-800">{reoData.security || "-"}</div>
                 </div>
                 <div>
                   <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">Housekeeping</div>
                   <div className="font-medium text-slate-800">{reoData.housekeeping || "-"}</div>
                 </div>
                 <div>
                   <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">Sales & Mkt</div>
                   <div className="font-medium text-slate-800">{reoData.salesMarketing || "-"}</div>
                 </div>
                 <div>
                   <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider">Other Dept</div>
                   <div className="font-medium text-slate-800">{reoData.otherDepartment || "-"}</div>
                 </div>
               </div>
             </div>
           </div>
        </div>

        {/* Signatures */}
        <div className="mt-6 print:mt-4 pt-4 print:pt-2 border-t border-slate-300">
           <div className="flex flex-wrap justify-between gap-4 px-2">
             
             {/* PREPARED BY */}
             <div className="flex flex-col items-center text-center w-36 relative">
               <div className="h-6 flex items-start justify-center w-full">
                 <p className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-widest">PREPARED BY</p>
               </div>
               
               <div className="h-16 print:h-12 w-full flex items-center justify-center relative z-10 mb-2">
                 {event.creatorSignatureUrl ? (
                   <TransparentSignature src={event.creatorSignatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                 ) : null}
               </div>
               
               <div className="w-full">
                 <p className="text-[11px] print:text-[10px] font-bold text-slate-800 border-b border-slate-300 w-full pb-1 z-10 relative uppercase tracking-wider">
                   {event.createdByName || reoData.preparedBy || "Pembuat"}
                 </p>
                 <p className="text-[9px] print:text-[8px] text-slate-400 mt-1 tracking-wider h-4">
                   {event.createdAt ? format(new Date(event.createdAt.seconds ? event.createdAt.toDate() : event.createdAt), "dd MMM yyyy", { locale: localeId }) : ""}
                 </p>
               </div>
             </div>
             
             {/* APPROVERS */}
             {event.approvalFlow?.map((approver, index) => (
               <div key={index} className="flex flex-col items-center text-center w-36 relative">
                 <div className="h-6 flex items-start justify-center w-full">
                   <p className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                     {approver.actionType === "Mengetahui" ? "ACKNOWLEDGED BY" : "APPROVED BY"}
                   </p>
                 </div>
                 
                 <div className="h-16 print:h-12 w-full flex items-center justify-center relative z-10 mb-2">
                   {approver.status === "APPROVED" && (
                     <div className="absolute w-full flex items-center justify-center opacity-80 z-0">
                       <div className="px-2 py-0.5 border border-emerald-400 text-emerald-500 font-bold text-[8px] print:text-[7px] transform -rotate-12 rounded-sm tracking-widest">
                         APPROVED
                       </div>
                     </div>
                   )}
                   {approver.status === "REJECTED" && (
                     <div className="absolute w-full flex items-center justify-center opacity-80 z-0">
                       <div className="px-2 py-0.5 border border-red-400 text-red-500 font-bold text-[8px] print:text-[7px] transform -rotate-12 rounded-sm tracking-widest">
                         REJECTED
                       </div>
                     </div>
                   )}

                   {approver.signatureUrl && approver.status === "APPROVED" ? (
                     <TransparentSignature src={approver.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain relative z-10" />
                   ) : null}
                 </div>

                 <div className="w-full">
                   <p className="text-[11px] print:text-[10px] font-bold text-slate-800 border-b border-slate-300 w-full pb-1 z-10 relative uppercase tracking-wider">
                     {approver.approverName}
                   </p>
                   <p className="text-[9px] print:text-[8px] text-slate-500 mt-1 uppercase tracking-widest h-4">
                     {approver.approverRole}
                   </p>
                 </div>
               </div>
             ))}
           </div>

           <div className="mt-4 print:mt-2 text-center text-[8px] font-medium text-slate-400 uppercase tracking-widest">
             Please verify all arrangements meet the client's specifications prior to approval.
           </div>
        </div>

      </div>
      
      {/* CONSOLIDATED NOTES SECTION */}
      {event.approvalFlow?.some((a) => a.note) && (
        <div className="w-full max-w-5xl mx-auto mt-8 pt-6 border-t border-slate-200 print:hidden mb-32">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Catatan Persetujuan / Penolakan:</h3>
          <div className="flex flex-col gap-3">
            {event.approvalFlow.map((approver, index) => {
              if (!approver.note) return null;
              return (
                <div key={`note-${index}`} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2 w-full max-w-2xl">
                  <p className="text-sm font-bold text-slate-700 flex items-center justify-between">
                    <span>{approver.approverName} <span className="text-slate-500 font-normal">({approver.approverRole})</span></span>
                    {approver.status === "APPROVED" && <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full text-xs">Disetujui</span>}
                    {approver.status === "REJECTED" && <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full text-xs">Ditolak</span>}
                  </p>
                  <p className={`text-base font-medium italic leading-relaxed whitespace-pre-wrap ${approver.status === "REJECTED" ? "text-red-600" : "text-slate-700"}`}>
                    "{approver.note}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Bar */}
      {isCurrentApprover() && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50 print:hidden">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-bold text-slate-800">Menunggu Persetujuan Anda</p>
              <p className="text-sm text-slate-500">Silakan tinjau REO ini sebelum memberikan keputusan.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => openActionModal("REJECT")}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-white text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                Tolak
              </button>
              <button
                onClick={() => openActionModal("APPROVE")}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? "Memproses..." : "Setujui & Tanda Tangani"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className={`p-4 border-b ${actionModal.type === "APPROVE" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
              <h3 className={`font-bold text-lg ${actionModal.type === "APPROVE" ? "text-emerald-800" : "text-red-800"}`}>
                {actionModal.type === "APPROVE" ? "Persetujuan Dokumen" : "Penolakan Dokumen"}
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Catatan {actionModal.type === "APPROVE" ? "(Opsional)" : "(Wajib Diisi)"}
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={actionModal.type === "APPROVE" ? "Tambahkan catatan jika ada..." : "Tuliskan alasan penolakan..."}
                className="w-full h-32 border border-slate-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm bg-slate-50 focus:bg-white transition-colors"
              />
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setActionModal({ isOpen: false, type: null })}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={submitAction}
                  disabled={isProcessing}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-colors shadow-sm ${
                    actionModal.type === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isProcessing ? "Menyimpan..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* CSS Khusus Print */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}} />
    </ProtectedRoute>
  );
}
