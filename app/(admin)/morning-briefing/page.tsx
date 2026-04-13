// app/(admin)/morning-briefing/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

// ==================== KOMPONEN VOICE RECORDER ====================
function VoiceRecorder({ onMeetingProcessed }: { onMeetingProcessed: (result: any) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'id-ID';
        
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setTranscript(prev => prev + ' ' + finalTranscript);
          }
        };
        
        recognition.onerror = (event: any) => {
          console.error('Error:', event.error);
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };
        
        recognition.onend = () => {
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };
        
        recognitionRef.current = recognition;
      } else {
        alert('Browser Anda tidak mendukung Speech Recognition. Gunakan Chrome, Edge, atau Safari.');
      }
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}`;
    return `0:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      setTranscript('');
      setRecordingTime(0);
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const stopRecording = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      
      if (transcript.trim()) {
        setIsLoading(true);
        try {
          const response = await fetch('/api/process-meeting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, duration: recordingTime }),
          });
          const data = await response.json();
          onMeetingProcessed(data);
        } catch (error) {
          console.error('Error:', error);
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="group relative bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all inline-flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="text-2xl">🎙️</span>
            Mulai Rekam Meeting
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all inline-flex items-center gap-3 shadow-lg animate-pulse"
          >
            <span className="text-2xl">⏹️</span>
            Stop Rekam ({formatTime(recordingTime)})
          </button>
        )}
        
        {isRecording && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
            <span className="text-red-600 text-sm font-medium">Meeting berlangsung... Rekam semua pembicaraan</span>
          </div>
        )}
      </div>

      {transcript && (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <span className="text-xl">📝</span>
              Transkrip Meeting
              {isRecording && <span className="text-xs text-green-600 ml-2 bg-green-100 px-2 py-0.5 rounded-full">● LIVE</span>}
            </h3>
            <span className="text-xs text-gray-400">{transcript.split(' ').length} kata</span>
          </div>
          <div className="bg-white rounded-xl p-4 max-h-60 overflow-y-auto">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {transcript}
              {isRecording && <span className="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1" />}
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl">
          <div className="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 mt-3 font-medium">AI sedang menganalisis percakapan meeting...</p>
          <p className="text-xs text-gray-400 mt-1">Memahami tanya jawab & mengekstrak poin penting</p>
        </div>
      )}
    </div>
  );
}

// ==================== KOMPONEN HASIL MEETING ====================
function MeetingResult({ result }: { result: any }) {
  if (!result) return null;
  
  if (result.error) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
        <p className="text-red-600">{result.error}</p>
      </div>
    );
  }
  
  const hasData = (result.actionItems?.length > 0) || 
                  (result.decisions?.length > 0) || 
                  (result.schedules?.length > 0) || 
                  (result.issues?.length > 0);
  
  if (!hasData) {
    return (
      <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200 text-center">
        <p className="text-yellow-600">Tidak dapat mengekstrak poin penting. Coba rekam dengan lebih jelas.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-5">
      {result.executiveSummary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📋</span>
            <h3 className="font-semibold text-blue-800">Ringkasan Meeting</h3>
          </div>
          <p className="text-gray-700 leading-relaxed">{result.executiveSummary}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-3 text-center border border-yellow-200">
          <div className="text-2xl mb-1">🎯</div>
          <div className="text-xl font-bold text-gray-800">{result.actionItems?.length || 0}</div>
          <div className="text-xs text-gray-500">Action Items</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 text-center border border-green-200">
          <div className="text-2xl mb-1">✅</div>
          <div className="text-xl font-bold text-gray-800">{result.decisions?.length || 0}</div>
          <div className="text-xs text-gray-500">Keputusan</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 text-center border border-purple-200">
          <div className="text-2xl mb-1">📅</div>
          <div className="text-xl font-bold text-gray-800">{result.schedules?.length || 0}</div>
          <div className="text-xs text-gray-500">Jadwal</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 text-center border border-red-200">
          <div className="text-2xl mb-1">⚠️</div>
          <div className="text-xl font-bold text-gray-800">{result.issues?.length || 0}</div>
          <div className="text-xs text-gray-500">Kendala</div>
        </div>
      </div>
      
      {result.actionItems && result.actionItems.length > 0 && (
        <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎯</span>
            <h3 className="font-semibold text-yellow-800">Action Items</h3>
            <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full ml-2">{result.actionItems.length} tugas</span>
          </div>
          <div className="space-y-2">
            {result.actionItems.slice(0, 5).map((item: any, idx: number) => (
              <div key={idx} className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 w-4 h-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500" />
                  <div className="flex-1">
                    <p className="text-gray-800">{item.task}</p>
                    {(item.assignee || item.deadline) && (
                      <div className="flex flex-wrap gap-3 mt-1 text-xs">
                        {item.assignee && <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">👤 {item.assignee}</span>}
                        {item.deadline && <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">📅 {item.deadline}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="pt-2">
        <button
          onClick={() => {
            const text = JSON.stringify(result, null, 2);
            navigator.clipboard.writeText(text);
            alert('✅ Hasil meeting disalin ke clipboard!');
          }}
          className="w-full px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
        >
          <span>📋</span> Salin Hasil Meeting
        </button>
      </div>
    </div>
  );
}

// ==================== KOMPONEN FILTER TANGGAL ====================
function DateRangeFilter({ onFilterChange }: { onFilterChange: (startDate: string, endDate: string) => void }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleFilter = () => {
    onFilterChange(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    onFilterChange('', '');
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📅</span>
        <h4 className="text-sm font-medium text-gray-700">Filter Tanggal</h4>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handleFilter}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🔍 Filter
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== KOMPONEN RIWAYAT MEETING ====================
function MeetingHistory({ meetings, onSelectMeeting }: { meetings: any[]; onSelectMeeting: (meeting: any) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredMeetings = meetings.filter(meeting => 
    meeting.executiveSummary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    meeting.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📭</div>
        <p className="text-gray-500 font-medium">Belum ada riwayat meeting</p>
        <p className="text-xs text-gray-400 mt-1">Rekam meeting pertama Anda</p>
      </div>
    );
  }
  
  return (
    <div>
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Cari meeting..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 pl-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {filteredMeetings.map((meeting) => (
          <div 
            key={meeting.id}
            onClick={() => onSelectMeeting(meeting)}
            className="group bg-white rounded-xl p-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent cursor-pointer transition-all duration-200 border border-gray-100 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-gray-800">
                    {new Date(meeting.date).toLocaleDateString('id-ID', { 
                      day: 'numeric', 
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(meeting.date).toLocaleTimeString('id-ID', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  {meeting.durationDisplay && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      ⏱️ {meeting.durationDisplay}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {meeting.executiveSummary || 'Tidak ada ringkasan'}
                </p>
                <div className="flex gap-3 mt-2 text-xs">
                  {meeting.actionItems?.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                      🎯 {meeting.actionItems.length}
                    </span>
                  )}
                  {meeting.decisions?.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      ✅ {meeting.decisions.length}
                    </span>
                  )}
                  {meeting.schedules?.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      📅 {meeting.schedules.length}
                    </span>
                  )}
                </div>
              </div>
              <button className="text-blue-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                Lihat →
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {filteredMeetings.length === 0 && searchTerm && (
        <div className="text-center py-8 text-gray-500">
          <p>Tidak ditemukan meeting dengan kata kunci "<strong>{searchTerm}</strong>"</p>
        </div>
      )}
    </div>
  );
}

// ==================== HALAMAN UTAMA ====================
export default function MorningBriefingPage() {
  const { user: currentUser } = useAuth();
  const [meetingResult, setMeetingResult] = useState<any>(null);
  const [allMeetings, setAllMeetings] = useState<any[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Role checking
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin";
  const isHR = currentUser?.role === "hr";

  // Load meetings from Firestore
  const loadMeetingsFromFirestore = async () => {
    setIsLoadingHistory(true);
    try {
      const q = query(collection(db, "meetings"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const meetings = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setAllMeetings(meetings);
      applyDateFilter(meetings, startDate, endDate);
    } catch (error) {
      console.error("Error loading meetings:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Apply date filter
  const applyDateFilter = (meetings: any[], filterStart: string, filterEnd: string) => {
    if (!filterStart && !filterEnd) {
      setFilteredMeetings(meetings);
      return;
    }
    
    const filtered = meetings.filter(meeting => {
      const meetingDate = new Date(meeting.date);
      
      if (filterStart && filterEnd) {
        return meetingDate >= new Date(filterStart) && meetingDate <= new Date(filterEnd);
      } else if (filterStart) {
        return meetingDate >= new Date(filterStart);
      } else if (filterEnd) {
        return meetingDate <= new Date(filterEnd);
      }
      return true;
    });
    
    setFilteredMeetings(filtered);
  };

  // Handle filter change
  const handleFilterChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    applyDateFilter(allMeetings, newStartDate, newEndDate);
  };

  useEffect(() => {
    loadMeetingsFromFirestore();
  }, []);

  const handleMeetingProcessed = (result: any) => {
    setMeetingResult(result);
    loadMeetingsFromFirestore();
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin", "hr"]}>
      <div className="space-y-6 p-6">
        {/* Header - Sama seperti Attendance Page */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-xl">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">🎙️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Meeting Intelligence</h1>
                <p className="text-blue-100 mt-1">
                  Rekam meeting, AI akan mengekstrak poin-poin penting secara otomatis
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Sama seperti Attendance Page */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Meetings</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{allMeetings.length}</p>
              </div>
              <div className="rounded-xl bg-blue-100 p-3">
                <span className="text-2xl">🎙️</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-yellow-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Action Items</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {allMeetings.reduce((sum, m) => sum + (m.actionItems?.length || 0), 0)}
                </p>
              </div>
              <div className="rounded-xl bg-yellow-100 p-3">
                <span className="text-2xl">🎯</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-green-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Decisions</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {allMeetings.reduce((sum, m) => sum + (m.decisions?.length || 0), 0)}
                </p>
              </div>
              <div className="rounded-xl bg-green-100 p-3">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-purple-100/50 blur-2xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Schedules</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {allMeetings.reduce((sum, m) => sum + (m.schedules?.length || 0), 0)}
                </p>
              </div>
              <div className="rounded-xl bg-purple-100 p-3">
                <span className="text-2xl">📅</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Section - Sama seperti Attendance Page */}
        <div className="rounded-xl bg-white p-5 shadow-md border border-gray-100">
          <h2 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter Data
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => handleFilterChange(startDate, endDate)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🔍 Filter
              </button>
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  handleFilterChange('', '');
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ↺ Reset
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Voice Recorder */}
          <div className="space-y-6">
            <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                  <span>🎙️</span> Rekam Meeting Baru
                </h2>
              </div>
              <div className="p-6">
                <VoiceRecorder onMeetingProcessed={handleMeetingProcessed} />
              </div>
            </div>

            {/* Hasil Meeting */}
            {meetingResult && (
              <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                    <span>📊</span> Hasil Analisis Meeting
                  </h2>
                </div>
                <div className="p-6">
                  <MeetingResult result={meetingResult} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: History */}
          <div className="space-y-6">
            <div className="rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                    <span>📜</span> Riwayat Meeting
                  </h2>
                  {isLoadingHistory && (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>
              <div className="p-6">
                <MeetingHistory meetings={filteredMeetings} onSelectMeeting={setMeetingResult} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500 border border-gray-200">
          <p>🎤 Didukung oleh Web Speech API (real-time voice to text)</p>
          <p className="text-xs text-gray-400 mt-1">Browser yang didukung: Chrome, Edge, Safari</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </ProtectedRoute>
  );
}