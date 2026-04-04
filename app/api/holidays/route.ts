// app/api/holidays/route.ts (bukan [year]/route.ts)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = searchParams.get('year') || new Date().getFullYear().toString();
  
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return NextResponse.json(
      { success: false, error: 'Tahun tidak valid' },
      { status: 400 }
    );
  }
  
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${yearNum}/ID`);
    const holidays = await response.json();
    
    const formattedHolidays = holidays.map((holiday: any) => ({
      date: holiday.date,
      name: holiday.localName,
    }));
    
    return NextResponse.json({
      success: true,
      year: yearNum,
      holidays: formattedHolidays,
    });
  } catch (error) {
    // Fallback data
    const fallbackHolidays = getFallbackHolidays(yearNum);
    return NextResponse.json({
      success: true,
      year: yearNum,
      holidays: fallbackHolidays,
      fromCache: true,
    });
  }
}

function getFallbackHolidays(year: number) {
  const holidays = [];
  holidays.push(
    { date: `${year}-01-01`, name: "Tahun Baru Masehi" },
    { date: `${year}-05-01`, name: "Hari Buruh" },
    { date: `${year}-06-01`, name: "Hari Lahir Pancasila" },
    { date: `${year}-08-17`, name: "Hari Kemerdekaan" },
    { date: `${year}-12-25`, name: "Natal" }
  );
  return holidays;
}