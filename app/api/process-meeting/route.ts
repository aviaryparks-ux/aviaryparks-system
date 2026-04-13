// app/api/process-meeting/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

// 🔥 FUNGSI ANALISIS DENGAN AI
async function analyzeWithAI(transcript: string, duration: number) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Anda adalah asisten AI yang ahli dalam merangkum meeting perusahaan.

**OUTPUT FORMAT JSON:**
{
  "executiveSummary": "Ringkasan eksekutif 2-3 kalimat",
  "decisions": ["Keputusan penting"],
  "actionItems": [
    {
      "task": "Deskripsi tugas",
      "assignee": "Penanggung jawab",
      "deadline": "Deadline"
    }
  ],
  "schedules": [
    {
      "event": "Nama jadwal",
      "date": "Tanggal",
      "time": "Waktu"
    }
  ],
  "issues": ["Masalah/kendala"],
  "recommendations": ["Rekomendasi"]
}

Penting: Hanya output JSON, tidak ada teks lain.`
        },
        {
          role: 'user',
          content: `Berikut transkrip meeting:\n\n${transcript}\n\nDurasi: ${duration} detik`
        }
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found');
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    return fallbackAnalyze(transcript, duration);
  }
}

// 🔥 FALLBACK
function fallbackAnalyze(transcript: string, duration: number) {
  const corrections: Record<string, string> = {
    'longgin': 'login', 'loggin': 'login', 'bugar': 'bug',
    'selasa': 'Selasa', 'rabu': 'Rabu', 'kamis': 'Kamis',
    'jumat': 'Jumat', 'sabtu': 'Sabtu', 'minggu': 'Minggu',
  };
  
  let corrected = transcript;
  for (const [wrong, correct] of Object.entries(corrections)) {
    corrected = corrected.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct);
  }
  
  const sentences = corrected.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  const decisions: any[] = [];
  const actionItems: any[] = [];
  const schedules: any[] = [];
  const issues: any[] = [];
  const recommendations: any[] = [];
  
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (lower.includes('setuju') || lower.includes('disetujui')) {
      decisions.push(sentence.trim());
    } else if (lower.includes('tolong') || lower.includes('kerjakan') || lower.includes('siapkan')) {
      actionItems.push({ task: sentence.trim(), assignee: '', deadline: '' });
    } else if (lower.includes('besok') || lower.includes('minggu') || lower.includes('tanggal')) {
      schedules.push({ event: sentence.trim(), date: '', time: '' });
    } else if (lower.includes('masalah') || lower.includes('kendala')) {
      issues.push(sentence.trim());
    } else if (lower.includes('saran') || lower.includes('sebaiknya')) {
      recommendations.push(sentence.trim());
    }
  }
  
  return {
    executiveSummary: sentences.slice(0, 2).join('. ') || corrected.substring(0, 200),
    decisions,
    actionItems,
    schedules,
    issues,
    recommendations,
  };
}

// ================= DETECT SPEAKERS =================
function detectSpeakers(transcript: string) {
  const speakers: Record<string, number> = {};
  const lines = transcript.split('\n');
  
  lines.forEach(line => {
    const match = line.match(/^([A-Za-z ]+):/);
    if (match) {
      const name = match[1].trim();
      speakers[name] = (speakers[name] || 0) + 1;
    }
  });
  
  return speakers;
}

// ================= MAIN POST =================
export async function POST(request: Request) {
  try {
    const { transcript, duration = 0, meetingTitle = "Meeting Report" } = await request.json();

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json({ error: 'Tidak ada transkrip' }, { status: 400 });
    }
    
    let analysis;
    const useAI = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== '';
    
    if (useAI) {
      try {
        analysis = await analyzeWithAI(transcript, duration);
      } catch (aiError) {
        console.error('AI analysis failed, using fallback:', aiError);
        analysis = fallbackAnalyze(transcript, duration);
      }
    } else {
      analysis = fallbackAnalyze(transcript, duration);
    }
    
    // Detect speakers
    analysis.speakers = detectSpeakers(transcript);
    
    // 🔥 ==================== SIMPAN KE FIRESTORE ====================
    const meetingId = uuidv4();
    
    // 🔥 PASTIKAN SEMUA NILAI VALID (TIDAK undefined)
    const meetingData = {
      id: meetingId,
      title: meetingTitle || "Meeting Report",
      date: new Date().toISOString(),
      timestamp: new Date(),
      executiveSummary: analysis.executiveSummary || "",
      decisions: analysis.decisions || [],
      actionItems: analysis.actionItems || [],
      schedules: analysis.schedules || [],
      issues: analysis.issues || [],
      recommendations: analysis.recommendations || [],
      speakers: analysis.speakers || {},
      rawTranscript: (transcript || "").substring(0, 3000),
      duration: duration || 0,
      aiPowered: useAI === true ? true : false, // 🔥 PASTIKAN BOOLEAN, BUKAN undefined
    };
    
    // Simpan ke collection "meetings"
    const docRef = await addDoc(collection(db, "meetings"), meetingData);
    console.log("✅ Meeting saved to Firestore with ID:", docRef.id);
    
    // Simpan action items ke sub-collection
    if (analysis.actionItems && analysis.actionItems.length > 0) {
      const tasksRef = collection(db, "meetings", docRef.id, "tasks");
      for (const task of analysis.actionItems) {
        await addDoc(tasksRef, {
          task: task.task || "",
          assignee: task.assignee || "",
          deadline: task.deadline || "",
          status: "pending",
          createdAt: new Date(),
        });
      }
      console.log(`✅ Saved ${analysis.actionItems.length} action items`);
    }
    
    const durationHours = Math.floor(duration / 3600);
    const durationMinutes = Math.floor((duration % 3600) / 60);
    let durationDisplay = "";
    if (durationHours > 0) durationDisplay = `${durationHours} jam ${durationMinutes} menit`;
    else durationDisplay = `${durationMinutes} menit`;
    
    const totalPoints = 
      (analysis.decisions?.length || 0) + 
      (analysis.actionItems?.length || 0) + 
      (analysis.schedules?.length || 0) + 
      (analysis.issues?.length || 0) + 
      (analysis.recommendations?.length || 0);
    
    return NextResponse.json({
      success: true,
      firestoreId: docRef.id,
      meetingId,
      executiveSummary: analysis.executiveSummary || "",
      decisions: analysis.decisions || [],
      actionItems: analysis.actionItems || [],
      schedules: analysis.schedules || [],
      issues: analysis.issues || [],
      recommendations: analysis.recommendations || [],
      speakers: analysis.speakers || {},
      duration,
      durationDisplay,
      totalPoints,
      aiPowered: useAI === true,
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Gagal memproses meeting' }, { status: 500 });
  }
}