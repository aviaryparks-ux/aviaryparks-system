"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, Search, Megaphone, Image as ImageIcon } from "lucide-react";

export default function MobileAnnouncements() {
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("semua");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { value: "semua", label: "Semua" },
    { value: "perusahaan", label: "Perusahaan" },
    { value: "unit_kerja", label: "Unit Kerja" },
  ];

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "articles"),
        where("isActive", "==", true)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort in memory to avoid needing composite index
      data.sort((a: any, b: any) => (b.publishedAt?.toDate()?.getTime() || 0) - (a.publishedAt?.toDate()?.getTime() || 0));
      setArticles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchCategory = selectedCategory === "semua" || article.category === selectedCategory;
    const searchString = searchQuery.toLowerCase();
    const matchSearch = searchString === "" || 
                        (article.title?.toLowerCase().includes(searchString) || 
                         article.content?.toLowerCase().includes(searchString));
    return matchCategory && matchSearch;
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "-";
    return timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative z-20">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/mobile/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={24} className="text-gray-800" />
          </Link>
          <h1 className="text-xl font-bold text-gray-800 flex-1">Pengumuman</h1>
        </div>

        {/* SEARCH BAR */}
        <div className="mt-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input 
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-green-500 focus:ring-1 focus:ring-green-500 sm:text-sm"
            placeholder="Cari pengumuman..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* CATEGORY TABS */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ARTICLE LIST */}
      <div className="flex-1 p-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : filteredArticles.length > 0 ? (
          <div className="space-y-4">
            {filteredArticles.map(article => (
              <Link 
                href={`/mobile/announcements/${article.id}`} 
                key={article.id}
                className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  {article.imageUrl ? (
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={article.imageUrl} 
                        alt={article.title} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400">
                      <ImageIcon size={32} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          article.category === 'perusahaan' ? 'bg-blue-50 text-blue-600' :
                          article.category === 'unit_kerja' ? 'bg-purple-50 text-purple-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {categories.find(c => c.value === (article.category || 'semua'))?.label || 'Pengumuman'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {formatDate(article.publishedAt)}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm line-clamp-2 leading-tight mt-1.5">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {article.excerpt || article.content?.replace(/<[^>]+>/g, '').substring(0, 100) || "Tidak ada ringkasan."}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Megaphone size={32} />
            </div>
            <h3 className="text-gray-800 font-bold mb-1">Tidak ada pengumuman</h3>
            <p className="text-gray-500 text-sm">Belum ada pengumuman untuk kategori ini.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
