import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  isToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  getDay,
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { appointmentsApi, trainersApi } from '../lib/api';
import clsx from 'clsx';
import AppointmentModal from '../components/AppointmentModal';
import AppointmentDetailModal from '../components/AppointmentDetailModal';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 - 20:00

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  trainer: { id: string; name: string; color: string };
  trainingType: { id: string; name: string; icon: string; color: string };
  participants: { id: string; name: string; email: string }[];
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTrainers, setSelectedTrainers] = useState<string[]>([]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [createInitialData, setCreateInitialData] = useState<{ date?: Date; startTime?: string } | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Detect if mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers'],
    queryFn: trainersApi.getAll,
  });

  const { data: appointments = [], refetch: refetchAppointments } = useQuery<Appointment[]>({
    queryKey: ['appointments', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () =>
      appointmentsApi.getAll(weekStart.toISOString(), weekEnd.toISOString()),
  });

  // Initialize selected trainers when trainers load
  useMemo(() => {
    if (trainers.length > 0 && selectedTrainers.length === 0) {
      setSelectedTrainers(trainers.map((t: any) => t.id));
    }
  }, [trainers]);

  const days = isMobile
    ? [currentDate] // Single day on mobile
    : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const filteredAppointments = appointments.filter(
    (apt) =>
      selectedTrainers.length === 0 || selectedTrainers.includes(apt.trainer.id)
  );

  const toggleTrainer = (trainerId: string) => {
    setSelectedTrainers((prev) =>
      prev.includes(trainerId)
        ? prev.filter((id) => id !== trainerId)
        : [...prev, trainerId]
    );
  };

  const getAppointmentStyle = (apt: Appointment) => {
    const start = new Date(apt.startTime);
    const end = new Date(apt.endTime);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    const top = (startHour - 6) * 60; // 60px per hour
    const height = Math.max((endHour - startHour) * 60, 30); // Min height 30px

    return { top: `${top}px`, height: `${height}px` };
  };

  // Touch handlers for swipe navigation (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;

    // Only handle horizontal swipes (ignore vertical scrolling)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe left - next day/week
        setCurrentDate(isMobile ? addDays(currentDate, 1) : addWeeks(currentDate, 1));
      } else {
        // Swipe right - previous day/week
        setCurrentDate(isMobile ? subDays(currentDate, 1) : subWeeks(currentDate, 1));
      }
    }
  };

  // Mini month calendar for picker
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    // Add padding days from previous month
    const startDay = getDay(start);
    const paddingDays = startDay === 0 ? 6 : startDay - 1; // Monday = 0
    for (let i = paddingDays - 1; i >= 0; i--) {
      days.unshift(subDays(start, i + 1));
    }

    // Add padding days for next month
    while (days.length < 42) {
      days.push(addDays(end, days.length - paddingDays - (end.getDate())));
    }

    return days.slice(0, 42);
  }, [currentDate]);

  const handleTimeSlotClick = (day: Date, hour: number) => {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    setCreateInitialData({ date: day, startTime });
    setIsCreateModalOpen(true);
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-6">
            {/* Desktop title */}
            <h1 className="hidden lg:block text-xl font-semibold text-gray-900">Agenda</h1>

            {/* Navigation */}
            <div className="flex items-center gap-1 lg:gap-2">
              <button
                onClick={() => setCurrentDate(isMobile ? subDays(currentDate, 1) : subWeeks(currentDate, 1))}
                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Date display - clickable for month picker */}
              <button
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[140px] justify-center"
              >
                <span className="font-semibold text-gray-900">
                  {isMobile
                    ? format(currentDate, 'd MMMM', { locale: nl })
                    : format(currentDate, 'MMMM yyyy', { locale: nl })}
                </span>
                <CalendarIcon className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => setCurrentDate(isMobile ? addDays(currentDate, 1) : addWeeks(currentDate, 1))}
                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setCurrentDate(new Date())}
                className="ml-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                Vandaag
              </button>
            </div>
          </div>

          {/* Add button */}
          <button
            onClick={() => {
              setCreateInitialData(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nieuwe Afspraak</span>
          </button>
        </div>

        {/* Month Picker Dropdown */}
        {showMonthPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMonthPicker(false)}
            />
            <div className="absolute left-4 right-4 lg:left-auto lg:right-auto lg:w-72 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCurrentDate(subDays(startOfMonth(currentDate), 1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold">
                  {format(currentDate, 'MMMM yyyy', { locale: nl })}
                </span>
                <button
                  onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => (
                  <div key={d} className="py-1 text-gray-500 font-medium">
                    {d}
                  </div>
                ))}
                {monthDays.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentDate(day);
                      setShowMonthPicker(false);
                    }}
                    className={clsx(
                      'py-2 rounded-lg text-sm transition-colors',
                      !isSameMonth(day, currentDate) && 'text-gray-300',
                      isSameDay(day, currentDate) && 'bg-primary-500 text-white',
                      isToday(day) && !isSameDay(day, currentDate) && 'bg-primary-100 text-primary-600',
                      isSameMonth(day, currentDate) && !isSameDay(day, currentDate) && !isToday(day) && 'hover:bg-gray-100'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Trainer filters - scrollable on mobile */}
        <div className="flex items-center gap-3 mt-3 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
          <span className="text-sm text-gray-500 flex-shrink-0">Trainers:</span>
          <div className="flex gap-2 flex-shrink-0">
            {trainers.map((trainer: any) => (
              <button
                key={trainer.id}
                onClick={() => toggleTrainer(trainer.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 transition-colors whitespace-nowrap',
                  selectedTrainers.includes(trainer.id)
                    ? 'border-current'
                    : 'border-transparent bg-gray-100 text-gray-500'
                )}
                style={{
                  color: selectedTrainers.includes(trainer.id) ? trainer.color : undefined,
                  backgroundColor: selectedTrainers.includes(trainer.id)
                    ? `${trainer.color}15`
                    : undefined,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: trainer.color }}
                />
                {trainer.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Calendar Grid */}
      <div
        ref={calendarRef}
        className="flex-1 overflow-auto bg-white"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-12 lg:w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50">
            {!isMobile && <div className="h-12 lg:h-14 border-b border-gray-200" />}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] text-right pr-2 text-xs text-gray-400 -mt-2"
              >
                {hour}:00
              </div>
            ))}
          </div>

          {/* Days */}
          <div className={clsx('flex-1', !isMobile && 'grid grid-cols-7')}>
            {days.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={clsx(
                  'border-r border-gray-200 last:border-r-0 min-w-0',
                  !isMobile && (dayIndex === 5 || dayIndex === 6) && 'bg-gray-50/50'
                )}
              >
                {/* Day header - only on desktop week view */}
                {!isMobile && (
                  <div
                    className={clsx(
                      'h-12 lg:h-14 flex flex-col items-center justify-center border-b border-gray-200 sticky top-0 bg-white z-10',
                      isToday(day) && 'bg-primary-500 text-white'
                    )}
                  >
                    <span className={clsx('text-xs uppercase', isToday(day) ? 'text-white/80' : 'text-gray-500')}>
                      {format(day, 'EEE', { locale: nl })}
                    </span>
                    <span className="text-lg font-semibold">
                      {format(day, 'd')}
                    </span>
                  </div>
                )}

                {/* Day events */}
                <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
                  {/* Hour grid lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 h-[60px] border-b border-gray-100 cursor-pointer hover:bg-primary-50/30 transition-colors"
                      style={{ top: `${(hour - 6) * 60}px` }}
                      onClick={() => handleTimeSlotClick(day, hour)}
                    >
                      {/* Quarter hour lines */}
                      <div className="absolute left-0 right-0 top-[15px] border-b border-gray-50" />
                      <div className="absolute left-0 right-0 top-[30px] border-b border-gray-50" />
                      <div className="absolute left-0 right-0 top-[45px] border-b border-gray-50" />
                    </div>
                  ))}

                  {/* Current time indicator */}
                  {isToday(day) && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{
                        top: `${(new Date().getHours() + new Date().getMinutes() / 60 - 6) * 60}px`,
                      }}
                    >
                      <div className="relative">
                        <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                        <div className="h-0.5 bg-red-500" />
                      </div>
                    </div>
                  )}

                  {/* Appointments */}
                  {filteredAppointments
                    .filter((apt) => isSameDay(new Date(apt.startTime), day))
                    .map((apt) => (
                      <button
                        key={apt.id}
                        onClick={() => handleAppointmentClick(apt)}
                        className="absolute left-1 right-1 lg:left-1 lg:right-1 rounded-lg px-2 py-1 text-left overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all border-l-4 z-10"
                        style={{
                          ...getAppointmentStyle(apt),
                          backgroundColor: `${apt.trainer.color}20`,
                          borderLeftColor: apt.trainer.color,
                        }}
                      >
                        <div className="text-xs font-semibold truncate" style={{ color: apt.trainer.color }}>
                          {format(new Date(apt.startTime), 'HH:mm')} - {format(new Date(apt.endTime), 'HH:mm')}
                        </div>
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {apt.participants.map((p) => p.name).join(', ')}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {apt.trainingType.name}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AppointmentModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateInitialData(null);
        }}
        onSuccess={() => {
          refetchAppointments();
          setIsCreateModalOpen(false);
          setCreateInitialData(null);
        }}
        initialData={createInitialData}
      />

      <AppointmentDetailModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onEdit={() => {
          // TODO: Open edit modal
          setSelectedAppointment(null);
        }}
        onDelete={() => {
          refetchAppointments();
          setSelectedAppointment(null);
        }}
      />
    </div>
  );
}
