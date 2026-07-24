import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sheetId = searchParams.get('sheetId');

  if (!sheetId) {
    return NextResponse.json(
      { error: "Parameter sheetId tidak ditemukan" },
      { status: 400 }
    );
  }

  try {
    const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(googleSheetUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
         throw new Error("Spreadsheet tidak ditemukan atau Anda tidak memiliki akses (Pastikan akses disetel ke 'Anyone with the link').");
      }
      throw new Error(`Gagal mengunduh Spreadsheet (Status: ${response.status})`);
    }

    const csvData = await response.text();
    
    // Some basic validation to check if it looks like an HTML login page instead of CSV
    if (csvData.trim().startsWith("<!DOCTYPE html>") || csvData.includes("<html")) {
      throw new Error("Akses ditolak. Pastikan akses Google Spreadsheet sudah diatur ke 'Anyone with the link'.");
    }

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
      }
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
