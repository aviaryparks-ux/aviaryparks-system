"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppEvent } from "@/types/event";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { id } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

const locales = {
  "id": id,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function PublicCalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<any>('month');

  const goToBack = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (currentView === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (currentView === 'day') newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (currentView === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (currentView === 'day') newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const goToCurrent = () => setCurrentDate(new Date());

  const getLabel = () => {
    if (currentView === 'day') return format(currentDate, "dd MMMM yyyy", { locale: id });
    if (currentView === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${format(start, "dd MMM")} - ${format(end, "dd MMM yyyy", { locale: id })}`;
    }
    return format(currentDate, "MMMM yyyy", { locale: id });
  };

  useEffect(() => {
    const q = query(collection(db, "events"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allEvents: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as AppEvent;
        if (data.status !== "cancelled" && data.status !== "rejected") {
          if (data.startDate && data.startTime && data.endTime) {
            const startDateTime = new Date(`${data.startDate}T${data.startTime}:00`);
            const endDateTime = new Date(`${data.startDate}T${data.endTime}:00`);
            
            let venue = "";
            let pic = "";
            let color = "#3b82f6"; // default blue

            if (data.type === "FEO") {
              venue = data.feoData?.lunchArea || "";
              pic = data.feoData?.salesIncharge || "";
            } else if (data.type === "REO") {
              venue = `${data.reoData?.restaurantName || ""} (${data.reoData?.venueSection || ""})`;
              pic = data.reoData?.salesIncharge || "";
            }

            if (data.status === 'approved') {
              color = "#10b981"; // emerald
            } else if (data.status === 'negotiation' || data.status === 'draft') {
              color = "#f59e0b"; // amber
            } else {
              color = "#64748b"; // slate default
            }

            allEvents.push({
              id: doc.id,
              title: `${data.title} - ${venue}`,
              start: startDateTime,
              end: endDateTime,
              allDay: false,
              resource: {
                originalData: { ...data, id: doc.id },
                color,
                venue,
                pic
              }
            });
          }
        }
      });
      setEvents(allEvents);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const eventStyleGetter = (event: any, start: Date, end: Date, isSelected: boolean) => {
    var backgroundColor = event.resource?.color || "#3174ad";
    var style = {
      backgroundColor: backgroundColor,
      borderRadius: '8px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      padding: '2px 5px',
      fontSize: '0.85em',
      fontWeight: 'bold'
    };
    return {
      style: style
    };
  };

  return (
    <ProtectedRoute requiredFeature="view_calendar">
      <div className="w-full h-[calc(100vh-2rem)] p-4 sm:p-6 lg:p-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Kalender Event</h1>
            <p className="text-slate-500 mt-1">Jadwal seluruh FEO dan REO (Active & Draft)</p>
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <span className="w-4 h-4 rounded-full bg-emerald-500"></span> Approved
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <span className="w-4 h-4 rounded-full bg-amber-500"></span> Draft / Negotiation
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <span className="w-4 h-4 rounded-full bg-red-500"></span> Rejected
              </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 rounded-xl overflow-hidden p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Custom External Toolbar */}
                <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 mb-6">
                  <div className="flex gap-2">
                    <button onClick={goToCurrent} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors cursor-pointer">
                      Hari Ini
                    </button>
                    <div className="flex rounded-xl overflow-hidden border border-slate-200">
                      <button onClick={goToBack} className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 transition-colors border-r border-slate-200 cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button onClick={goToNext} className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-bold text-slate-800 capitalize">{getLabel()}</h2>
                  
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white p-1 gap-1">
                    {['month', 'week', 'day', 'agenda'].map((v) => (
                      <button 
                        key={v}
                        onClick={() => setCurrentView(v)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize cursor-pointer ${currentView === v ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {v === 'month' ? 'Bulan' : v === 'week' ? 'Minggu' : v === 'day' ? 'Hari' : 'Agenda'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  <Calendar
                    localizer={localizer}
                    events={events}
                    date={currentDate}
                    onNavigate={(date) => setCurrentDate(date)}
                    view={currentView}
                    onView={(view) => setCurrentView(view)}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    eventPropGetter={eventStyleGetter}
                    onSelectEvent={(event) => setSelectedEvent(event)}
                    views={['month', 'week', 'day', 'agenda']}
                    toolbar={false}
                    popup
                    culture="id"
                    min={new Date(0, 0, 0, 6, 0, 0)}
                    max={new Date(0, 0, 0, 23, 0, 0)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="flex items-center gap-3 mb-4 pr-8">
               <span 
                 className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                 style={{ backgroundColor: selectedEvent.resource?.color }}
               >
                 {selectedEvent.resource?.originalData?.type}
               </span>
               <div>
                  <h3 className="text-xl font-bold text-slate-800 leading-tight">{selectedEvent.resource?.originalData?.title}</h3>
                  <p className="text-sm text-slate-500 font-medium">{format(selectedEvent.start, "dd MMM yyyy", { locale: id })}</p>
               </div>
            </div>
            
            <div className="space-y-3 mt-6">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Waktu</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {format(selectedEvent.start, "HH:mm")} - {format(selectedEvent.end, "HH:mm")}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Lokasi / Venue</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedEvent.resource?.venue}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">PIC / Client</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedEvent.resource?.originalData?.clientName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">PIC Internal: {selectedEvent.resource?.pic}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Status</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">
                    {selectedEvent.resource?.originalData?.status === 'approved' && <span className="text-emerald-600">Approved</span>}
                    {selectedEvent.resource?.originalData?.status === 'draft' && <span className="text-slate-600">Draft</span>}
                    {selectedEvent.resource?.originalData?.status === 'negotiation' && <span className="text-blue-600">Negotiation</span>}
                    {selectedEvent.resource?.originalData?.status === 'rejected' && <span className="text-red-600">Rejected</span>}
                    {!['approved', 'draft', 'negotiation', 'rejected'].includes(selectedEvent.resource?.originalData?.status) && <span>{selectedEvent.resource?.originalData?.status || '-'}</span>}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <a 
                href={`/events/${selectedEvent.resource?.originalData?.type.toLowerCase()}/${selectedEvent.resource?.originalData?.id}`}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
              >
                Lihat Detail Penuh
              </a>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
