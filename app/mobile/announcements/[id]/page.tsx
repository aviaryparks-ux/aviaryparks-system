"use client";

import { useEffect, useState, use } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, User, Calendar, Image as ImageIcon } from "lucide-react";

export default function AnnouncementDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [article, setArticle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadArticle();
  }, [resolvedParams.id]);

  const loadArticle = async () => {
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, "articles", resolvedParams.id));
      if (snap.exists()) {
        setArticle({ id: snap.id, ...snap.data() });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    return timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getCategoryLabel = (cat: string) => {
    if (cat === 'perusahaan') return 'Perusahaan';
    if (cat === 'unit_kerja') return 'Unit Kerja';
    return 'Pengumuman';
  };

  const getCategoryColor = (cat: string) => {
    if (cat === 'perusahaan') return 'bg-blue-50 text-blue-600';
    if (cat === 'unit_kerja') return 'bg-purple-50 text-purple-600';
    return 'bg-green-50 text-green-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col relative z-20">
        <div className="flex items-center gap-3 p-4">
          <Link href="/mobile/announcements" className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={24} className="text-gray-800" />
          </Link>
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-white flex flex-col relative z-20">
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <Link href="/mobile/announcements" className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={24} className="text-gray-800" />
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Tidak Ditemukan</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-500">Pengumuman tidak ditemukan atau sudah dihapus.</p>
          <Link href="/mobile/announcements" className="mt-4 px-6 py-2 bg-green-600 text-white rounded-full font-medium">
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative z-20 pb-20">
      {/* HEADER OVERLAY ON IMAGE OR SOLID IF NO IMAGE */}
      {article.imageUrl ? (
        <div className="relative w-full h-64 sm:h-80 bg-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={article.imageUrl} 
            alt={article.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50"></div>
          
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
            <Link href="/mobile/announcements" className="w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-colors">
              <ArrowLeft size={20} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white px-4 py-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Link href="/mobile/announcements" className="p-2 -ml-2 rounded-full hover:bg-gray-100">
              <ArrowLeft size={24} className="text-gray-800" />
            </Link>
            <h1 className="text-xl font-bold text-gray-800 flex-1 truncate">Detail Pengumuman</h1>
          </div>
        </div>
      )}

      {/* CONTENT BOX */}
      <div className={`px-5 py-6 ${article.imageUrl ? '-mt-6 bg-white rounded-t-3xl relative z-10' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getCategoryColor(article.category)}`}>
            {getCategoryLabel(article.category)}
          </span>
          <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
            <Calendar size={12} />
            {formatDate(article.publishedAt)}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-4">
          {article.title}
        </h1>

        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <User size={16} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Ditulis oleh</p>
            <p className="text-sm font-semibold text-gray-800">{article.author || 'Admin'}</p>
          </div>
        </div>

        {/* HTML CONTENT */}
        <div 
          className="prose prose-sm prose-green max-w-none prose-img:rounded-xl prose-img:shadow-sm"
          dangerouslySetInnerHTML={{ __html: article.content || '<p>Tidak ada konten.</p>' }}
        ></div>
      </div>
    </div>
  );
}
