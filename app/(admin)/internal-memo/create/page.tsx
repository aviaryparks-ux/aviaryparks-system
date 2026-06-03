// app/(admin)/internal-memo/create/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, getDoc, doc, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import RichTextEditor from "@/components/ui/RichTextEditor";

export default function CreateMemoPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();
  
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [memoTo, setMemoTo] = useState("");
  const [memoFrom, setMemoFrom] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    if (user?.name) {
      setMemoFrom(user.name);
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("name"));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })).filter(u => u.uid !== user?.uid); // Exclude self
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleAddApprover = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uid = e.target.value;
    if (!uid) return;
    
    const selectedUser = users.find(u => u.uid === uid);
    if (selectedUser && !selectedApprovers.some(a => a.uid === uid)) {
      setSelectedApprovers([...selectedApprovers, { ...selectedUser, actionType: "Menyetujui" }]);
    }
    e.target.value = ""; // Reset select
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

  const generateMemoNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const romanMonth = romanMonths[date.getMonth()];
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Format: 000/AJL/DEPT-IM/ROMAN_MONTH/YYYY
    // deptPembuat menyesuaikan role user
    let deptPembuat = user?.role ? user.role.toUpperCase() : 'DEPT';
    
    // Kita hapus karakter non-alphanumeric atau spasi dari role jika terlalu panjang (opsional)
    // deptPembuat = deptPembuat.replace(/[^A-Z]/g, '');

    return `${randomNum}/AJL/${deptPembuat}-IM/${romanMonth}/${year}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !content.trim()) {
      alert("⚠️ Perihal dan isi memo tidak boleh kosong.");
      return;
    }
    
    if (selectedApprovers.length === 0) {
      alert("⚠️ Harap pilih minimal 1 Approver.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get creator's signature
      let creatorSignatureUrl = null;
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          creatorSignatureUrl = userDoc.data()?.signatureUrl || null;
        }
      }

      if (!creatorSignatureUrl) {
        alert("⚠️ Anda belum memiliki Tanda Tangan Digital. Harap atur di menu Profil terlebih dahulu sebelum membuat Memo.");
        setIsSubmitting(false);
        return;
      }

      const approvalFlow = selectedApprovers.map((approver) => ({
        approverUid: approver.uid,
        approverName: approver.name,
        approverRole: approver.role || "Pegawai",
        actionType: approver.actionType || "Menyetujui",
        status: "WAITING",
        signatureUrl: null,
        approvedAt: null,
      }));

      const newMemo = {
        memoNumber: generateMemoNumber(),
        memoTo: memoTo || "All Staff",
        memoFrom: memoFrom || (user?.role || "Management"),
        subject,
        content,
        createdBy: {
          uid: user?.uid,
          name: user?.name,
          role: user?.role,
          signatureUrl: creatorSignatureUrl
        },
        createdAt: new Date(),
        status: "PENDING", // Automatically pending
        approvalFlow,
        currentApproverIndex: 0,
      };

      await addDoc(collection(db, "internal_memos"), newMemo);
      alert("✅ Memo berhasil dibuat dan dikirim untuk persetujuan!");
      router.push("/internal-memo");
    } catch (error) {
      console.error("Error creating memo:", error);
      alert("❌ Gagal membuat memo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!can("manage_memo")) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-gray-800">Akses Ditolak</h2>
        <p className="text-gray-500 mt-2">Anda tidak memiliki izin untuk membuat Memo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <button 
          onClick={() => router.back()}
          className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1 mb-2"
        >
          &larr; Kembali
        </button>
        <h1 className="text-2xl font-bold text-slate-800">Buat Internal Memo Baru</h1>
        <p className="text-sm text-slate-500 mt-1">Isi detail memo dan tentukan alur persetujuan</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Memo Details */}
        <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">1</span>
            Detail Memo
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kepada
                </label>
                <input
                  type="text"
                  list="users-list"
                  value={memoTo}
                  onChange={(e) => setMemoTo(e.target.value)}
                  placeholder="Misal: All Staff"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  required
                />
                <datalist id="users-list">
                  <option value="All Staff" />
                  <option value="HR Department" />
                  <option value="Finance Department" />
                  {users.map((u) => (
                    <option key={u.uid} value={u.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dari
                </label>
                <input
                  type="text"
                  value={memoFrom}
                  onChange={(e) => setMemoFrom(e.target.value)}
                  placeholder="Misal: HR Department"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Perihal / Subjek
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Misal: Pengajuan Perangkat Kerja Baru"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Isi Memo
              </label>
              <div className="bg-white rounded-lg overflow-hidden">
                <RichTextEditor 
                  content={content} 
                  onChange={setContent} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Approval Flow */}
        <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">2</span>
            Alur Persetujuan (Approval Flow)
          </h2>
          <p className="text-xs text-slate-500 mb-6 pl-10">Pilih siapa saja yang harus menyetujui memo ini secara BERURUTAN.</p>
          
          <div className="mb-4">
            <select 
              onChange={handleAddApprover}
              className="w-full md:w-1/2 border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500"
              defaultValue=""
            >
              <option value="" disabled>+ Tambahkan Approver Baru</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* List of Approvers */}
          <div className="space-y-2">
            {selectedApprovers.length === 0 ? (
              <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm bg-gray-50">
                Belum ada approver yang dipilih. Silakan tambah di atas.
              </div>
            ) : (
              selectedApprovers.map((approver, index) => (
                <div key={approver.uid} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <button type="button" onClick={() => moveApprover(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                    <button type="button" onClick={() => moveApprover(index, 'down')} disabled={index === selectedApprovers.length - 1} className="text-gray-400 hover:text-emerald-600 disabled:opacity-30">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-sm">{approver.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{approver.role}</p>
                  </div>
                  
                  <div className="mr-4">
                    <select
                      value={approver.actionType}
                      onChange={(e) => updateApproverAction(index, e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 bg-gray-50 focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      <option value="Mengetahui">Diketahui Oleh</option>
                      <option value="Menyetujui">Disetujui Oleh</option>
                    </select>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => handleRemoveApprover(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <button 
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Mengirim..." : "Kirim Pengajuan Memo"}
          </button>
        </div>
      </form>
    </div>
  );
}
