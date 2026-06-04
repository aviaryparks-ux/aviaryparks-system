// app/(admin)/internal-memo/[id]/page.tsx
"use client";
import LoadingScreen from "@/components/ui/LoadingScreen";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { usePermissions } from "@/hooks/usePermissions";

export default function MemoDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();

  const [memo, setMemo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; type: "APPROVE" | "REJECT" | null }>({ isOpen: false, type: null });
  const [actionNote, setActionNote] = useState("");

  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchMemo();
      fetchCurrentUser();
    }
  }, [user, id]);

  const fetchMemo = async () => {
    try {
      const docRef = doc(db, "internal_memos", id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setMemo({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Memo tidak ditemukan!");
        router.push("/internal-memo");
      }
    } catch (error) {
      console.error("Error fetching memo:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      if (userDoc.exists()) {
        setCurrentUserData(userDoc.data());
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  // Determine if current user is the ACTIVE approver
  const isCurrentApprover = () => {
    if (!memo || memo.status !== "PENDING" || !user) return false;
    const currentApprover = memo.approvalFlow?.[memo.currentApproverIndex || 0];
    return currentApprover?.approverUid === user.uid;
  };

  // Safely format dates whether they are Firestore Timestamps or JS Dates
  const formatDate = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      if (typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return new Date(dateValue).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return "";
    }
  };

  const openActionModal = (type: "APPROVE" | "REJECT") => {
    if (!can("approve_memo")) {
      alert("⚠️ Anda tidak memiliki hak akses.");
      return;
    }
    if (type === "APPROVE" && !currentUserData?.signatureUrl) {
      alert("⚠️ Anda belum memiliki Tanda Tangan Digital. Silakan atur di My Profile terlebih dahulu.");
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
      const flow = [...memo.approvalFlow];
      const idx = memo.currentApproverIndex;
      
      if (actionModal.type === "APPROVE") {
        flow[idx].status = "APPROVED";
        flow[idx].signatureUrl = currentUserData?.signatureUrl;
      } else {
        flow[idx].status = "REJECTED";
      }
      
      flow[idx].note = actionNote.trim();
      flow[idx].approvedAt = new Date();

      const nextIdx = idx + 1;
      const isFullyApproved = nextIdx >= flow.length;
      
      const updateData: any = {
        approvalFlow: flow,
      };

      if (actionModal.type === "APPROVE") {
        updateData.currentApproverIndex = nextIdx;
        updateData.status = isFullyApproved ? "APPROVED" : "PENDING";
      } else {
        updateData.status = "REJECTED";
      }

      await updateDoc(doc(db, "internal_memos", memo.id), updateData);
      setActionModal({ isOpen: false, type: null });
      fetchMemo();
    } catch (error) {
      console.error("Error processing action:", error);
      alert("❌ Terjadi kesalahan saat memproses aksi.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} size={150} />;

  if (!memo) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto print:p-0 print:max-w-none print:w-full">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <div>
          <button 
            onClick={() => router.push("/internal-memo")}
            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1 mb-2"
          >
            &larr; Kembali
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Detail Memo</h1>
        </div>
        <div className="flex gap-3">
          {(memo.status === "APPROVED" || memo.status === "REJECTED") && (
            <button
              onClick={async () => {
                try {
                  setIsDownloading(true);
                  const html2pdf = (await import('html2pdf.js')).default;
                  const element = document.getElementById('memo-pdf-container');
                  
                  // Pastikan elemen benar-benar siap dan terlihat (bisa pakai posisi off-screen agar tidak mengganggu layout utama)
                  if (element) {
                    const opt = {
                      margin: 0,
                      filename: `Internal_Memo_${memo.memoNumber?.replace(/\//g, '-') || 'Doc'}.pdf`,
                      image: { type: 'jpeg' as const, quality: 1.0 },
                      html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
                      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
                    };
                    
                    await html2pdf().set(opt).from(element).save();
                  }
                } catch (err) {
                  console.error("PDF generation failed", err);
                  alert("Gagal membuat PDF");
                } finally {
                  setIsDownloading(false);
                }
              }}
              disabled={isDownloading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm flex items-center gap-2 print:hidden disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {isDownloading ? "Memproses..." : "Download PDF"}
            </button>
          )}
          <div className="px-4 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 flex items-center">
            Status: {memo.status}
          </div>
        </div>
        {/* Hidden Container Khusus PDF Generator */}
        <div style={{ position: 'fixed', right: '200vw', top: 0 }}>
          <div id="memo-pdf-container" style={{ width: '794px', minHeight: '1122px', backgroundColor: 'white', position: 'relative' }}>
            <img src="/kop_surat.png" alt="Kop Surat" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1122px', objectFit: 'fill', zIndex: 0 }} />
            
            <div style={{ position: 'relative', zIndex: 10, padding: '128px 56px 64px 56px' }}>
              <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', fontFamily: 'sans-serif', color: '#1e293b', margin: 0 }}>INTERNAL MEMO</h1>
              
              <table style={{ marginTop: '32px', width: '100%', fontSize: '16px', color: '#1e293b', fontWeight: 500, fontFamily: 'sans-serif', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '15%', paddingBottom: '8px' }}>Dari</td>
                    <td style={{ width: '85%', paddingBottom: '8px' }}>: {memo.memoFrom || `${memo.createdBy?.name} (${memo.createdBy?.role})`}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: '8px' }}>Kepada</td>
                    <td style={{ paddingBottom: '8px' }}>: {memo.memoTo || "All Staff"}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: '8px' }}>No IM</td>
                    <td style={{ paddingBottom: '8px' }}>: {memo.memoNumber}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: '8px' }}>Perihal</td>
                    <td style={{ paddingBottom: '8px', fontWeight: 700 }}>: {memo.subject}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingTop: '8px' }}>Tanggal</td>
                    <td style={{ paddingTop: '8px' }}>: {formatDate(memo.createdAt)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ borderTop: '2px solid #1e293b', paddingTop: '24px', marginTop: '24px', minHeight: '300px', color: '#1e293b' }}>
                <div className="pdf-content" style={{ fontFamily: 'sans-serif', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: memo.content }} />
                <style dangerouslySetInnerHTML={{ __html: `
                  .pdf-content p { margin-bottom: 1em; }
                  .pdf-content strong { font-weight: bold; }
                  .pdf-content table { border-collapse: collapse; table-layout: fixed; width: 100%; margin-bottom: 1em; }
                  .pdf-content table td, .pdf-content table th { border: 1px solid #94a3b8; padding: 8px; vertical-align: top; }
                  .pdf-content table th { background-color: #f1f5f9; font-weight: bold; text-align: left; }
                  .pdf-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1em; }
                  .pdf-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1em; }
                `}} />
              </div>
  
              {/* Tanda Tangan PDF */}
              <div style={{ marginTop: '64px', paddingTop: '32px', pageBreakInside: 'avoid' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: '32px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '160px', position: 'relative' }}>
                     <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Dibuat Oleh,</p>
                     
                     {memo.createdBy?.signatureUrl ? (
                       <div style={{ height: '64px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '8px' }}>
                         <img src={memo.createdBy.signatureUrl.startsWith('data:') ? memo.createdBy.signatureUrl : `/_next/image?url=${encodeURIComponent(memo.createdBy.signatureUrl)}&w=256&q=75`} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                       </div>
                     ) : (
                       <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}></div>
                     )}
                     
                     <p style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid #94a3b8', width: '100%', paddingBottom: '4px', zIndex: 10, position: 'relative', color: '#1e293b', margin: 0 }}>
                       {memo.createdBy?.name || "Pembuat"}
                     </p>
                     <p style={{ fontSize: '12px', marginTop: '4px', textTransform: 'capitalize', color: '#475569', margin: 0 }}>{memo.createdBy?.role || "Staff"}</p>
                     <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>{formatDate(memo.createdAt)}</p>
                  </div>
      
                  {memo.approvalFlow?.map((approver: any, index: number) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '160px', position: 'relative' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Disetujui Oleh,</p>
                      
                      {approver.status === "APPROVED" && (
                        <div style={{ position: 'absolute', top: '24px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9, zIndex: 0 }}>
                          <div style={{ padding: '4px 12px', border: '2px solid #10b981', color: '#10b981', fontWeight: 700, fontSize: '12px', transform: 'rotate(-12deg)', borderRadius: '4px' }}>
                            APPROVED
                          </div>
                        </div>
                      )}
                      {approver.status === "REJECTED" && (
                        <div style={{ position: 'absolute', top: '24px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9, zIndex: 0 }}>
                          <div style={{ padding: '4px 12px', border: '2px solid #ef4444', color: '#ef4444', fontWeight: 700, fontSize: '12px', transform: 'rotate(-12deg)', borderRadius: '4px' }}>
                            REJECTED
                          </div>
                        </div>
                      )}
      
                      {approver.signatureUrl && approver.status === "APPROVED" ? (
                        <div style={{ height: '64px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10, marginBottom: '8px' }}>
                          <img src={approver.signatureUrl.startsWith('data:') ? approver.signatureUrl : `/_next/image?url=${encodeURIComponent(approver.signatureUrl)}&w=256&q=75`} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                        </div>
                      ) : (
                        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, marginBottom: '8px' }}></div>
                      )}
      
                      <p style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid #94a3b8', width: '100%', paddingBottom: '4px', zIndex: 10, position: 'relative', color: '#1e293b', margin: 0 }}>
                        {approver.approverName}
                      </p>
                      <p style={{ fontSize: '12px', marginTop: '4px', textTransform: 'capitalize', color: '#475569', margin: 0 }}>{approver.approverRole}</p>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
                        {approver.approvedAt ? formatDate(approver.approvedAt) : "Belum diproses"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tampilan Visual (Biasa) */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 mb-8 relative print:hidden overflow-hidden w-full max-w-[794px] mx-auto" style={{ minHeight: '1122px' }}>
        <img src="/kop_surat.png" alt="Kop Surat" className="absolute top-0 left-0 w-full z-0 pointer-events-none" style={{ height: '1122px', objectFit: 'fill' }} />

        <div className="relative z-10 px-10 md:px-14 pt-32 pb-16">
          <div className="mb-6">
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-widest text-center font-sans">INTERNAL MEMO</h1>
          </div>
  
          <div className="grid grid-cols-12 gap-y-2 mb-8 text-sm md:text-base text-slate-800 font-medium font-sans">
            <div className="col-span-3 md:col-span-2">Dari</div>
            <div className="col-span-9 md:col-span-10">: {memo.memoFrom || `${memo.createdBy?.name} (${memo.createdBy?.role})`}</div>
            <div className="col-span-3 md:col-span-2">Kepada</div>
            <div className="col-span-9 md:col-span-10">: {memo.memoTo || "All Staff"}</div>
            <div className="col-span-3 md:col-span-2">No IM</div>
            <div className="col-span-9 md:col-span-10">: {memo.memoNumber}</div>
            <div className="col-span-3 md:col-span-2">Perihal</div>
            <div className="col-span-9 md:col-span-10 font-bold">: {memo.subject}</div>
            <div className="col-span-3 md:col-span-2 mt-2">Tanggal</div>
            <div className="col-span-9 md:col-span-10 mt-2">: {formatDate(memo.createdAt)}</div>
          </div>
  
          <div className="border-t-2 border-slate-800 pt-6 min-h-[300px]">
            <div 
              className="text-slate-800 prose prose-sm md:prose-base max-w-none font-sans leading-relaxed"
              dangerouslySetInnerHTML={{ __html: memo.content }}
            />
            <style dangerouslySetInnerHTML={{ __html: `
              .prose table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; }
              .prose table td, .prose table th { border: 1px solid #94a3b8; padding: 8px; vertical-align: top; }
              .prose table th { background-color: #f1f5f9; font-weight: bold; text-align: left; }
              .prose ul { list-style-type: disc; padding-left: 1.5rem; }
              .prose ol { list-style-type: decimal; padding-left: 1.5rem; }
            `}} />
          </div>
  
          <div className="mt-16 pt-8">
            <div className="flex flex-wrap justify-around gap-8">
              <div className="flex flex-col items-center justify-end h-32 text-center w-40 relative">
                 <p className="text-sm font-bold text-slate-800 mb-auto">Dibuat Oleh,</p>
                 {memo.createdBy?.signatureUrl ? (
                   <div className="h-16 w-full flex items-center justify-center relative">
                     <img src={memo.createdBy.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                   </div>
                 ) : (
                   <div className="h-16 flex items-center justify-center"></div>
                 )}
                 <p className="text-sm font-bold text-slate-800 border-b border-slate-400 w-full pb-1 z-10 relative">
                   {memo.createdBy?.name || "Pembuat"}
                 </p>
                 <p className="text-xs text-slate-600 mt-1 capitalize">{memo.createdBy?.role || "Staff"}</p>
                 <p className="text-[10px] text-slate-500">{formatDate(memo.createdAt)}</p>
              </div>
  
              {memo.approvalFlow?.map((approver: any, index: number) => (
                <div key={index} className="flex flex-col items-center justify-end h-32 text-center w-40 relative">
                  <p className="text-sm font-bold text-slate-800 mb-auto">Disetujui Oleh,</p>
                  
                  {approver.status === "APPROVED" && (
                    <div className="absolute top-8 w-full flex items-center justify-center opacity-90 z-0">
                      <div className="px-3 py-1 border-2 border-emerald-500 text-emerald-500 font-bold text-xs transform -rotate-12 rounded">
                        APPROVED
                      </div>
                    </div>
                  )}
                  {approver.status === "REJECTED" && (
                    <div className="absolute top-8 w-full flex items-center justify-center opacity-90 z-0">
                      <div className="px-3 py-1 border-2 border-red-500 text-red-500 font-bold text-xs transform -rotate-12 rounded">
                        REJECTED
                      </div>
                    </div>
                  )}
  
                  {approver.signatureUrl && approver.status === "APPROVED" ? (
                    <div className="h-16 w-full flex items-center justify-center relative z-10">
                      <img src={approver.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    </div>
                  ) : (
                    <div className="h-16 flex items-center justify-center z-10"></div>
                  )}
  
                  <p className="text-sm font-bold text-slate-800 border-b border-slate-400 w-full pb-1 z-10 relative">
                    {approver.approverName}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 capitalize">{approver.approverRole}</p>
                  <p className="text-[10px] text-slate-500">
                    {approver.approvedAt ? formatDate(approver.approvedAt) : "Belum diproses"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONSOLIDATED NOTES SECTION */}
      {memo.approvalFlow?.some((a: any) => a.note || a.rejectReason) && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Catatan Persetujuan / Penolakan:</h3>
          <div className="flex flex-col gap-3">
            {memo.approvalFlow.map((approver: any, index: number) => {
              const noteContent = approver.note || approver.rejectReason;
              if (!noteContent) return null;
              
              return (
                <div key={`note-${index}`} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2 w-full max-w-2xl">
                  <p className="text-sm font-bold text-slate-700 flex items-center justify-between">
                    <span>{approver.approverName} <span className="text-slate-500 font-normal">({approver.approverRole})</span></span>
                    {approver.status === "APPROVED" && <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full text-xs">Disetujui</span>}
                    {approver.status === "REJECTED" && <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full text-xs">Ditolak</span>}
                  </p>
                  <p className={`text-base font-medium italic leading-relaxed whitespace-pre-wrap ${approver.status === "REJECTED" ? "text-red-600" : "text-slate-700"}`}>
                    "{noteContent}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isCurrentApprover() && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50 print:hidden">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-bold text-slate-800">Menunggu Persetujuan Anda</p>
              <p className="text-sm text-slate-500">Silakan tinjau memo ini sebelum memberikan keputusan.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => openActionModal("REJECT")}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg font-bold text-sm bg-white text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                Tolak
              </button>
              <button
                onClick={() => openActionModal("APPROVE")}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? "Memproses..." : "Setujui & Tanda Tangani"}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal.isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className={`p-4 border-b ${actionModal.type === "APPROVE" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
              <h3 className={`font-bold text-lg ${actionModal.type === "APPROVE" ? "text-emerald-800" : "text-red-800"}`}>
                {actionModal.type === "APPROVE" ? "Persetujuan Memo" : "Penolakan Memo"}
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Catatan {actionModal.type === "APPROVE" ? "(Opsional)" : "(Wajib Diisi)"}
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={actionModal.type === "APPROVE" ? "Tambahkan catatan persetujuan jika ada..." : "Tuliskan alasan penolakan dokumen ini..."}
                className="w-full h-32 border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm"
              />
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setActionModal({ isOpen: false, type: null })}
                  className="px-4 py-2 rounded-lg font-medium text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={submitAction}
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-lg font-bold text-sm text-white transition-colors shadow-sm ${
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
    </div>
  );
}
