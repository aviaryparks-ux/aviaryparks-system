// app/(admin)/articles/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";
import imageCompression from "browser-image-compression";

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: "semua" | "perusahaan" | "unit_kerja";
  imageUrl: string;
  imageFile?: File | null;
  publishedAt: any;
  author: string;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

const CATEGORIES = [
  { value: "semua", label: "Semua" },
  { value: "perusahaan", label: "Perusahaan" },
  { value: "unit_kerja", label: "Unit Kerja" },
];

const EMPTY_ARTICLE: Article = {
  id: "",
  title: "",
  content: "",
  excerpt: "",
  category: "semua",
  imageUrl: "",
  imageFile: null,
  publishedAt: null,
  author: "",
  isActive: true,
  createdAt: null,
  updatedAt: null,
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [formData, setFormData] = useState<Article>(EMPTY_ARTICLE);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "articles"), orderBy("publishedAt", "desc"));
      const snap = await getDocs(q);
      const data: Article[] = [];
      snap.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as Article);
      });
      setArticles(data);
    } catch (err: any) {
      console.error("Error loading articles:", err);
      setError(err.message || "Gagal memuat data artikel");
    } finally {
      setLoading(false);
    }
  }

  function openModal(article?: Article) {
    if (article) {
      setEditingArticle(article);
      setFormData({ ...article, imageFile: null });
    } else {
      setEditingArticle(null);
      setFormData({ ...EMPTY_ARTICLE, author: "Admin" });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingArticle(null);
    setFormData(EMPTY_ARTICLE);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!formData.title.trim()) {
      alert("Judul artikel wajib diisi");
      return;
    }
    if (!formData.content.trim()) {
      alert("Konten artikel wajib diisi");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = formData.imageUrl;

      if (formData.imageFile) {
        // Kompres gambar sebelum upload
        const compressedFile = await imageCompression(formData.imageFile, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        });

        const fileRef = storageRef(storage, `articles/${Date.now()}_${formData.imageFile.name}`);
        await uploadBytes(fileRef, compressedFile);
        imageUrl = await getDownloadURL(fileRef);

        if (editingArticle?.imageUrl) {
          try {
            const oldRef = storageRef(storage, editingArticle.imageUrl);
            await deleteObject(oldRef);
          } catch (_) {}
        }
      }

      const now = serverTimestamp();
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        excerpt: formData.excerpt.trim() || formData.content.substring(0, 120) + "...",
        category: formData.category || "semua",
        imageUrl,
        publishedAt: formData.publishedAt || now,
        author: formData.author || "Admin",
        isActive: formData.isActive,
        updatedAt: now,
      };

      if (editingArticle) {
        await updateDoc(doc(db, "articles", editingArticle.id), payload);
      } else {
        await addDoc(collection(db, "articles"), { ...payload, createdAt: now });
      }

      closeModal();
      await loadArticles();
    } catch (err: any) {
      console.error("Error saving article:", err);
      alert("Gagal menyimpan artikel: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const article = articles.find((a) => a.id === id);
      if (article?.imageUrl) {
        try {
          const fileRef = storageRef(storage, article.imageUrl);
          await deleteObject(fileRef);
        } catch (_) {}
      }
      await deleteDoc(doc(db, "articles", id));
      setDeleteConfirm(null);
      await loadArticles();
    } catch (err: any) {
      console.error("Error deleting article:", err);
      alert("Gagal menghapus artikel: " + err.message);
    }
  }

  const filtered = articles.filter((a) => {
    const matchCat = filterCategory === "semua" || a.category === filterCategory;
    const matchSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <ProtectedRoute requiredFeature="manage_articles">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="text-slate-600 font-medium text-lg">Memuat artikel...</p>
            <p className="text-slate-400 text-sm mt-2">Mohon tunggu sebentar</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredFeature="manage_articles">
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-6 lg:p-8">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          * { font-family: 'Plus Jakarta Sans', sans-serif; }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slideUp 0.5s ease-out forwards;
            opacity: 0;
          }
          .glass-effect {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.5);
          }
          .card-hover {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .card-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          }
        `}</style>

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-slide-up">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Pengumuman & Artikel</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Kelola konten pengumuman untuk karyawan</p>
          </div>
          <button
            onClick={() => openModal()}
            className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Artikel
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="glass-effect rounded-2xl p-5 mb-6 animate-slide-up flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center gap-3 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filterCategory === cat.value
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari judul artikel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>
            <button
              onClick={() => openModal()}
              className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="glass-effect rounded-2xl p-6 mb-6 border border-red-200 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-red-600">Terjadi kesalahan</p>
                <p className="text-sm text-slate-500">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Articles Grid */}
        {filtered.length === 0 ? (
          <div className="glass-effect rounded-2xl p-12 text-center animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">Belum ada artikel</h3>
            <p className="text-slate-500 mb-6">Mulai buat artikel pengumuman pertama Anda</p>
            <button
              onClick={() => openModal()}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30"
            >
              Buat Artikel Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((article, idx) => (
              <div
                key={article.id}
                className="glass-effect rounded-2xl overflow-hidden card-hover animate-slide-up"
                style={{ animationDelay: `${0.2 + idx * 0.05}s` }}
              >
                {/* Image */}
                <div className="relative h-48 bg-slate-100">
                  {article.imageUrl ? (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      article.category === "perusahaan"
                        ? "bg-blue-500 text-white"
                        : article.category === "unit_kerja"
                        ? "bg-purple-500 text-white"
                        : "bg-slate-500 text-white"
                    }`}>
                      {CATEGORIES.find((c) => c.value === article.category)?.label || article.category}
                    </span>
                  </div>
                  {!article.isActive && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-xl">Nonaktif</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-bold text-slate-800 text-lg mb-2 line-clamp-2">{article.title}</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">{article.excerpt || article.content.substring(0, 100)}...</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(article.publishedAt)}</span>
                    <span>•</span>
                    <span>{article.author}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => openModal(article)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(article.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
              <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingArticle ? "Edit Artikel" : "Buat Artikel Baru"}
                </h2>
                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Gambar Artikel</label>
                  <div
                    className="relative h-52 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden cursor-pointer hover:border-emerald-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {(formData.imageUrl || formData.imageFile) ? (
                      <img
                        src={formData.imageFile ? URL.createObjectURL(formData.imageFile) : formData.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                        <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium">Klik untuk upload gambar</p>
                        <p className="text-xs mt-1">PNG, JPG, WebP — max 5MB</p>
                      </div>
                    )}
                    {(formData.imageUrl || formData.imageFile) && (
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                        <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl text-sm font-medium text-slate-700">
                          Klik untuk ganti gambar
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, imageFile: file });
                    }}
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Judul Artikel</label>
                  <input
                    type="text"
                    placeholder="Masukkan judul artikel..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Ringkasan <span className="font-normal text-slate-400">(opsional)</span></label>
                  <textarea
                    placeholder="Ringkasan singkat artikel..."
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Konten Artikel</label>
                  <textarea
                    placeholder="Tulis konten artikel di sini..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Kategori</label>
                  <div className="flex gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setFormData((prev: any) => ({ ...prev, category: cat.value }))}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          formData.category === cat.value
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Author & Active */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Penulis</label>
                    <input
                      type="text"
                      placeholder="Nama penulis..."
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                    <div className="flex items-center gap-3 h-full">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          formData.isActive ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          formData.isActive ? "translate-x-7" : "translate-x-1"
                        }`} />
                      </button>
                      <span className="text-sm font-medium text-slate-600">
                        {formData.isActive ? "Publikasi" : "Nonaktif"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-60 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingArticle ? "Simpan Perubahan" : "Publikasikan"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Hapus Artikel?</h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                Artikel ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
