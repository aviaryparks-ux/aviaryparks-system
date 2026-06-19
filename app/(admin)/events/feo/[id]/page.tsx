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

export default function FEODetailPage() {
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
        console.error("Error fetching FEO:", error);
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

  if (loading) return <LoadingScreen message="Memuat FEO..." />;
  if (!event || !event.feoData) return <div className="p-8 text-center">Data FEO tidak ditemukan.</div>;

  const { feoData } = event;

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
    
    return `FEO/${noStr}/${tgl}/${bln}/${th}`;
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
              <button onClick={() => router.push(`/events/feo/${event.id}/edit`)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg">
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
            Cetak FEO
          </button>
        </div>
      </div>

      {/* Area Kertas Print */}
      <div className={`w-full max-w-5xl mx-auto bg-white p-8 sm:p-12 text-[11px] text-black font-sans leading-tight ${isPrinting ? 'shadow-none' : 'shadow-xl rounded-2xl mb-32'}`} id="print-area">
        
        {/* Header Kertas FEO */}
        <div className="relative border-b border-slate-300 pb-4 print:pb-2 mb-6 print:mb-4 flex flex-col items-center">
             {/* Tempat Logo */}
             <div className="h-24 print:h-16 mb-4 flex items-center justify-center">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src="/images/logo-aviarypark.svg" alt="Aviary Park Logo" className="max-h-full w-auto object-contain" />
             </div>
             
             <div className="text-center">
               <h1 className="text-2xl print:text-xl font-light tracking-[0.2em] text-slate-900">FIELDTRIP EVENT ORDER</h1>
               <p className="text-slate-500 font-medium tracking-wide text-xs print:text-[10px] mt-1 uppercase">Official Operational Document</p>
             </div>

             <div className="absolute top-0 right-0 text-right">
               <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Document No.</div>
               <div className="text-lg print:text-base font-medium text-slate-800 tracking-wider mb-2 print:mb-1">{getDocumentNumber()}</div>
               <div className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</div>
               <div className="text-xs print:text-[10px] font-bold text-slate-800 uppercase tracking-widest">{event.status}</div>
             </div>
        </div>

        {/* Tabel General Info */}
        <table className="w-full border-collapse border-2 border-black mb-4">
          <tbody>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black w-1/4">EVENT TYPE</td>
              <td className="p-2 border-r border-black w-1/4">Field Trip</td>
              <td className="p-2 border-r border-black w-[15%]">NO OF PAX</td>
              <td className="p-2 border-r border-black w-12 text-center">{feoData.paxTotal}</td>
              <td className="p-2 border-r border-black w-[15%]">NO. OF BUCKET HAT</td>
              <td className="p-2 w-12 text-center">{feoData.bucketHatCount || "-"}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black">SCHOOL NAME</td>
              <td className="p-2 border-r border-black">{feoData.schoolName || "-"}</td>
              <td className="p-2 border-r border-black">KIDS/STUDENT</td>
              <td className="p-2 border-r border-black text-center">{feoData.paxKids || "-"}</td>
              <td className="p-2 border-r border-black">NO. OF SOUVENIR</td>
              <td className="p-2 text-center">{feoData.souvenirCount || "-"}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black">PERSON INCHARGE</td>
              <td className="p-2 border-r border-black">{feoData.personIncharge || "-"}</td>
              <td className="p-2 border-r border-black">TEACHER</td>
              <td className="p-2 border-r border-black text-center">{feoData.paxTeacher || "-"}</td>
              <td className="p-2 border-r border-black">LUNCH AREA</td>
              <td className="p-2">{feoData.lunchArea || "-"}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black">SALES INCHARGE</td>
              <td className="p-2 border-r border-black">{feoData.salesIncharge || "-"}</td>
              <td className="p-2 border-r border-black bg-white" colSpan={4}></td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black">ADDRESS</td>
              <td className="p-2 border-r border-black">{feoData.address || "-"}</td>
              <td className="p-2 border-r border-black">PARENT/COMPANION</td>
              <td className="p-2 border-r border-black text-center">{feoData.paxParent || "-"}</td>
              <td className="p-2 bg-white" colSpan={2} rowSpan={3} style={{verticalAlign: 'top'}}>
                 <div className="font-bold mb-1 text-center border-b border-black pb-1">REMARKS</div>
                 <div className="whitespace-pre-wrap">{feoData.remarks || "-"}</div>
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black">MOBILE NO.</td>
              <td className="p-2 border-r border-black">{feoData.mobileNo || "-"}</td>
              <td className="p-2 border-r border-black">COMPLIMENTARY (FREE)</td>
              <td className="p-2 border-r border-black text-center">{feoData.paxComplimentary || "-"}</td>
            </tr>
            <tr>
              <td className="p-2 border-r border-black">DATE & TIME OF FIELDTRIP</td>
              <td className="p-2 border-r border-black">{format(new Date(event.startDate), "dd/MM/yyyy", { locale: localeId })} ({event.startTime} - {event.endTime})</td>
              <td className="p-2 border-r border-black bg-white" colSpan={2}></td>
            </tr>
          </tbody>
        </table>

        {/* Tabel Price Details */}
        <table className="w-full border-collapse border-2 border-black mb-4 text-center">
          <thead>
            <tr className="border-b border-black">
              <th className="p-2 border-r border-black" colSpan={4}>PRICE DETAIL</th>
            </tr>
            <tr className="border-b border-black">
              <th className="p-2 border-r border-black w-2/5">PACKAGE</th>
              <th className="p-2 border-r border-black w-1/5">NUMBER OF PAX</th>
              <th className="p-2 border-r border-black w-1/5">PRICE</th>
              <th className="p-2 w-1/5">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {feoData.priceDetails?.map((detail, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="p-2 border-r border-black text-left">{detail.packageName || "-"}</td>
                <td className="p-2 border-r border-black">{detail.pax}</td>
                <td className="p-2 border-r border-black">Rp{detail.price.toLocaleString('id-ID')}</td>
                <td className="p-2">Rp{detail.total.toLocaleString('id-ID')}</td>
              </tr>
            ))}
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black text-left">ADDITIONAL CHARGE : {feoData.additionalChargeName}</td>
              <td className="p-2 border-r border-black">{feoData.additionalChargePax}</td>
              <td className="p-2 border-r border-black">Rp{feoData.additionalChargePrice?.toLocaleString('id-ID')}</td>
              <td className="p-2">Rp{feoData.additionalChargeTotal?.toLocaleString('id-ID')}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black text-center" colSpan={3}>GRAND TOTAL</td>
              <td className="p-2">Rp{feoData.grandTotal?.toLocaleString('id-ID')}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black text-center" colSpan={3}>DOWN PAYMENT :</td>
              <td className="p-2 text-left">Rp{feoData.downPayment?.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td className="p-2 border-r border-black text-center" colSpan={3}>BALANCE PAYMENT :</td>
              <td className="p-2 text-left">Rp{feoData.balancePayment?.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>

        {/* Tabel Rundown & Dept */}
        <table className="w-full border-collapse border-2 border-black mb-12">
          <thead>
            <tr className="border-b border-black text-center">
              <th className="p-2 border-r border-black w-1/2">THE RUNDOWN</th>
              <th className="p-2 w-1/2">DEPARTEMENT NOTES</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black text-center">{feoData.zonaMorningTour || "ZONA/MORNING TOUR"}</td>
              <td className="p-2 text-left align-top" rowSpan={4}>
                 <div className="space-y-4">
                   <p><span className="font-bold">Notes Currator/Wildlife :</span> {feoData.notesCurator || "-"}</p>
                   <p><span className="font-bold">Notes Ticketing :</span> {feoData.notesTicketing || "-"}</p>
                   <p><span className="font-bold">Notes FB Kitchen :</span> {feoData.notesFBKitchen || "-"}</p>
                   <p><span className="font-bold">Notes FB Service :</span> {feoData.notesFBService || "-"}</p>
                   <p><span className="font-bold">Notes Housekeeping/Wahana :</span> {feoData.notesHousekeeping || "-"}</p>
                   <p><span className="font-bold">Notes Security :</span> {feoData.notesSecurity || "-"}</p>
                   <p><span className="font-bold">Notes Sales & Marketing :</span> {feoData.notesSalesMarketing || "-"}</p>
                 </div>
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black text-center">{feoData.lunchArea || "Half zone + lunch"}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-2 border-r border-black text-center font-bold">MEAL BOX</td>
            </tr>
            <tr>
              <td className="border-r border-black p-0 align-top">
                 <table className="w-full border-collapse">
                   <tbody>
                     <tr className="border-b border-black">
                       <td className="p-2 w-3/4 border-r border-black">KIDS : {feoData.mealBoxKids}</td>
                       <td className="p-2 w-1/4 text-center">{feoData.mealBoxKidsPax}</td>
                     </tr>
                     <tr className="border-b border-black">
                       <td className="p-2 w-3/4 border-r border-black">TEACHER : {feoData.mealBoxTeacher}</td>
                       <td className="p-2 w-1/4 text-center">{feoData.mealBoxTeacherPax}</td>
                     </tr>
                     <tr>
                       <td className="p-2 border-r border-black" colSpan={2}>DRIVER : {feoData.driver}</td>
                     </tr>
                   </tbody>
                 </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="flex flex-wrap justify-around gap-8 px-8 mt-16 pb-8">
           <div className="flex flex-col items-center justify-end h-32 text-center w-40 relative">
             <p className="text-xs font-bold text-slate-800 mb-auto uppercase">PREPARED BY</p>
             {event.creatorSignatureUrl ? (
               <div className="h-16 w-full flex items-center justify-center relative z-10">
                 <TransparentSignature src={event.creatorSignatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
               </div>
             ) : (
               <div className="h-16 flex items-center justify-center"></div>
             )}
             <p className="text-sm font-bold text-slate-800 border-b-2 border-slate-800 w-full pb-1 z-10 relative uppercase">
               {event.createdByName || feoData.preparedBy || "Pembuat"}
             </p>
             <p className="text-[10px] text-slate-500 mt-1">{event.createdAt ? format(new Date(event.createdAt.seconds ? event.createdAt.toDate() : event.createdAt), "dd MMM yyyy", { locale: localeId }) : ""}</p>
           </div>
           
           {event.approvalFlow?.map((approver, index) => (
             <div key={index} className="flex flex-col items-center justify-end h-32 text-center w-40 relative">
               <p className="text-xs font-bold text-slate-800 mb-auto uppercase">
                 {approver.actionType === "Mengetahui" ? "ACKNOWLEDGED BY" : "CHECKED BY"}
               </p>
               
               {approver.status === "APPROVED" && (
                 <div className="absolute top-8 w-full flex items-center justify-center opacity-90 z-0">
                   <div className="px-3 py-1 border-2 border-emerald-500 text-emerald-500 font-bold text-[10px] transform -rotate-12 rounded">
                     APPROVED
                   </div>
                 </div>
               )}
               {approver.status === "REJECTED" && (
                 <div className="absolute top-8 w-full flex items-center justify-center opacity-90 z-0">
                   <div className="px-3 py-1 border-2 border-red-500 text-red-500 font-bold text-[10px] transform -rotate-12 rounded">
                     REJECTED
                   </div>
                 </div>
               )}

               {approver.signatureUrl && approver.status === "APPROVED" ? (
                 <div className="h-16 w-full flex items-center justify-center relative z-10">
                   <TransparentSignature src={approver.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                 </div>
               ) : (
                 <div className="h-16 flex items-center justify-center z-10"></div>
               )}

               <p className="text-sm font-bold text-slate-800 border-b-2 border-slate-800 w-full pb-1 z-10 relative uppercase">
                 {approver.approverName}
               </p>
               <p className="text-xs text-slate-600 mt-1 capitalize">{approver.approverRole}</p>
             </div>
           ))}
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
              <p className="font-bold text-slate-800">Menunggu Pengecekan Anda</p>
              <p className="text-sm text-slate-500">Silakan tinjau FEO ini sebelum memberikan keputusan.</p>
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
