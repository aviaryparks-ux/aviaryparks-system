// app/components/VoiceRecorder.tsx
"use client";

import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Cek dukungan browser
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'id-ID'; // Bahasa Indonesia
        
        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript;
            }
          }
          if (currentTranscript) {
            setTranscript(prev => prev + ' ' + currentTranscript);
          }
        };
        
        recognition.onerror = (event: any) => {
          console.error('Error:', event.error);
          setIsRecording(false);
        };
        
        recognition.onend = () => {
          setIsRecording(false);
        };
        
        recognitionRef.current = recognition;
      } else {
        alert('Browser Anda tidak mendukung Speech Recognition. Gunakan Chrome, Edge, atau Safari.');
      }
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) {
      setTranscript('');
      setSummary('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      generateSummary();
    }
  };

  const generateSummary = async () => {
    if (!transcript.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      console.error('Error:', error);
      setSummary('Gagal membuat ringkasan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tombol Rekam */}
      <div className="text-center">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all inline-flex items-center gap-3 shadow-lg"
          >
            <span className="text-2xl">🎙️</span>
            Mulai Rekam Briefing
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all inline-flex items-center gap-3 shadow-lg animate-pulse"
          >
            <span className="text-2xl">⏹️</span>
            Stop Rekam
          </button>
        )}
        
        {isRecording && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
            <span className="text-red-600 text-sm">Sedang merekam...</span>
          </div>
        )}
      </div>

      {/* Transkrip */}
      {transcript && (
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-xl">📝</span>
            Transkrip
          </h3>
          <p className="text-gray-700 leading-relaxed">{transcript}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 mt-2">AI sedang merangkum briefing...</p>
        </div>
      )}

      {/* Ringkasan */}
      {summary && (
        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <span className="text-xl">📋</span>
            Ringkasan Morning Briefing
          </h3>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: summary }} />
          
          <div className="flex gap-3 mt-6 pt-4 border-t border-green-200">
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              📤 Share ke Tim
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              💾 Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}