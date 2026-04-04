// app/api/holidays/[year]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  // 🔥 WAJIB: await params karena sekarang berupa Promise
  const resolvedParams = await params;
  const year = resolvedParams.year;
  
  console.log('Received year param:', year);
  
  // Validasi tahun
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Tahun tidak valid. Gunakan tahun antara 2000-2100',
        receivedYear: year 
      },
      { status: 400 }
    );
  }
  
  try {
    // Panggil Nager.Date API
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${yearNum}/ID`,
      {
        next: { revalidate: 86400 },
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const holidays = await response.json();
    
    // Format ulang data
    const formattedHolidays = holidays.map((holiday: any) => ({
      date: holiday.date,
      name: holiday.localName,
      nameEn: holiday.name,
      types: holiday.types || ['Public'],
      isNational: holiday.global === true,
    }));
    
    return NextResponse.json({
      success: true,
      year: yearNum,
      total: formattedHolidays.length,
      holidays: formattedHolidays,
    });
    
  } catch (error) {
    console.error('Error fetching holidays:', error);
    
    // Fallback ke hardcode data jika API gagal
    const fallbackHolidays = getFallbackHolidays(yearNum);
    
    return NextResponse.json({
      success: true,
      year: yearNum,
      total: fallbackHolidays.length,
      holidays: fallbackHolidays,
      fromCache: true,
      message: 'Menggunakan data cadangan karena API utama bermasalah',
    });
  }
}

// Fallback data hardcode
function getFallbackHolidays(year: number) {
  const holidays = [];
  
  // Tanggal tetap setiap tahun
  holidays.push(
    { date: `${year}-01-01`, name: "Tahun Baru Masehi" },
    { date: `${year-1}-12-31`, name: "Tahun Baru Masehi" },
    { date: `${year}-05-01`, name: "Hari Buruh Internasional" },
    { date: `${year}-06-01`, name: "Hari Lahir Pancasila" },
    { date: `${year}-08-17`, name: "Hari Kemerdekaan RI" },
    { date: `${year}-12-25`, name: "Hari Raya Natal" },
    { date: `${year-1}-12-25`, name: "Hari Raya Natal" }
  );
  
  // Tahun 2024
  if (year === 2024) {
    holidays.push(
      { date: "2024-02-08", name: "Isra Mi'raj Nabi Muhammad SAW" },
      { date: "2024-02-10", name: "Tahun Baru Imlek 2575" },
      { date: "2024-03-11", name: "Hari Raya Nyepi" },
      { date: "2024-03-29", name: "Wafat Yesus Kristus" },
      { date: "2024-04-10", name: "Hari Raya Idul Fitri" },
      { date: "2024-04-11", name: "Hari Raya Idul Fitri" },
      { date: "2024-05-09", name: "Kenaikan Yesus Kristus" },
      { date: "2024-05-23", name: "Hari Raya Waisak" },
      { date: "2024-06-17", name: "Hari Raya Idul Adha" },
      { date: "2024-07-07", name: "Tahun Baru Islam" },
      { date: "2024-09-15", name: "Maulid Nabi Muhammad SAW" }
    );
  }
  
  // Tahun 2025
  if (year === 2025) {
    holidays.push(
      { date: "2025-01-29", name: "Tahun Baru Imlek 2576" },
      { date: "2025-03-29", name: "Hari Raya Nyepi" },
      { date: "2025-03-31", name: "Hari Raya Idul Fitri" },
      { date: "2025-04-01", name: "Hari Raya Idul Fitri" },
      { date: "2025-04-18", name: "Wafat Yesus Kristus" },
      { date: "2025-05-12", name: "Hari Raya Waisak" },
      { date: "2025-05-29", name: "Kenaikan Yesus Kristus" },
      { date: "2025-06-06", name: "Hari Raya Idul Adha" },
      { date: "2025-06-27", name: "Tahun Baru Islam" },
      { date: "2025-09-05", name: "Maulid Nabi Muhammad SAW" }
    );
  }
  
  // Tahun 2026
  if (year === 2026) {
    holidays.push(
      { date: "2026-02-17", name: "Tahun Baru Imlek" },
      { date: "2026-03-19", name: "Hari Raya Nyepi" },
      { date: "2026-03-21", name: "Hari Raya Idul Fitri" },
      { date: "2026-03-22", name: "Hari Raya Idul Fitri" },
      { date: "2026-04-03", name: "Wafat Yesus Kristus" },
      { date: "2026-05-14", name: "Kenaikan Yesus Kristus" },
      { date: "2026-05-28", name: "Hari Raya Waisak" }
    );
  }
  
  return holidays;
}