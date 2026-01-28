import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  setHours,
  setMinutes,
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { appointmentsApi, trainersApi, calendarApi } from '../lib/api';
import clsx from 'clsx';
import AppointmentModal from '../components/AppointmentModal';
import AppointmentDetailModal from '../components/AppointmentDetailModal';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 - 20:00

// Get current time in Amsterdam timezone
function getAmsterdamTime(): { hours: number; minutes: number } {
  const now = new Date();
  const amsterdamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  return {
    hours: amsterdamTime.getHours(),
    minutes: amsterdamTime.getMinutes(),
  };
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  recurrenceId?: string;
  trainer: { id: string; name: string; color: string };
  trainingType: { id: string; name: string; icon: string; color: string };
  participants: { id: string; name: string; email: string }[];
}

interface ICalEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isExternal: true;
}

// Expand recurring appointments into virtual instances
function expandRecurringAppointments(
  appointments: Appointment[],
  rangeStart: Date,
  rangeEnd: Date
): Appointment[] {
  const expanded: Appointment[] = [];

  for (const apt of appointments) {
    if (!apt.isRecurring || !apt.recurrenceRule) {
      // Non-recurring appointment - add as-is
      expanded.push(apt);
      continue;
    }

    // Calculate interval in days based on recurrence rule
    let intervalDays: number;
    switch (apt.recurrenceRule) {
      case 'daily':
        intervalDays = 1;
        break;
      case 'weekly':
        intervalDays = 7;
        break;
      case 'biweekly':
        intervalDays = 14;
        break;
      case 'monthly':
        intervalDays = 30; // Approximate
        break;
      default:
        intervalDays = 7;
    }

    const aptStart = new Date(apt.startTime);
    const aptEnd = new Date(apt.endTime);
    const duration = aptEnd.getTime() - aptStart.getTime();

    // Determine end date for recurrence
    const recurrenceEnd = apt.recurrenceEndDate
      ? new Date(apt.recurrenceEndDate)
      : null;

    // Generate instances within the range
    let currentStart = new Date(aptStart);
    let instanceCount = 0;
    // If no end date specified, limit to 2 years max for safety
    const maxInstances = recurrenceEnd ? 500 : 104;

    while (currentStart <= rangeEnd && instanceCount < maxInstances) {
      // Stop if we've passed the recurrence end date
      if (recurrenceEnd && currentStart > recurrenceEnd) {
        break;
      }

      const currentEnd = new Date(currentStart.getTime() + duration);

      // Check if this instance falls within the visible range
      if (currentEnd >= rangeStart && currentStart <= rangeEnd) {
        // First instance keeps original id, subsequent get derived ids
        const instanceId = instanceCount === 0 ? apt.id : `${apt.id}-rec-${instanceCount}`;

        expanded.push({
          ...apt,
          id: instanceId,
          startTime: currentStart.toISOString(),
          endTime: currentEnd.toISOString(),
          recurrenceId: apt.id, // Reference to original
        });
      }

      // Move to next occurrence - use addDays to handle DST correctly
      if (apt.recurrenceRule === 'monthly') {
        // For monthly, add actual month
        currentStart = new Date(currentStart);
        currentStart.setMonth(currentStart.getMonth() + 1);
      } else {
        // Use addDays instead of milliseconds to preserve time across DST changes
        currentStart = addDays(currentStart, intervalDays);
      }
      instanceCount++;
    }
  }

  return expanded;
}

// Draggable Appointment Component
function DraggableAppointment({
  apt,
  style,
  onClick,
}: {
  apt: Appointment;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: apt.id,
    data: { appointment: apt },
  });

  // Check if appointment is in the past
  const isPast = new Date(apt.endTime) < new Date();

  // Check if this has overlap positioning (has explicit left/width)
  const hasOverlapStyle = 'left' in style && 'width' in style;

  const dragStyle = {
    ...style,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : isPast ? 0.6 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'manipulation' as const,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Prevent click when dragging
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={clsx(
        "absolute rounded-lg px-2 py-1 text-left overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all border-l-4 z-10",
        !hasOverlapStyle && "left-1 right-1"
      )}
      style={{
        ...dragStyle,
        backgroundColor: isPast ? `${apt.trainer.color}10` : `${apt.trainer.color}20`,
        borderLeftColor: apt.trainer.color,
      }}
    >
      <div
        className="text-xs font-semibold truncate"
        style={{ color: apt.trainer.color, opacity: isPast ? 0.6 : 1 }}
      >
        {format(new Date(apt.startTime), 'HH:mm')} - {format(new Date(apt.endTime), 'HH:mm')}
      </div>
      <div
        className="text-xs font-medium truncate"
        style={{ color: isPast ? '#6b7280' : '#111827', opacity: isPast ? 0.7 : 1 }}
      >
        {apt.participants.map((p) => p.name).join(', ')}
      </div>
      <div
        className="text-xs truncate"
        style={{ color: isPast ? '#9ca3af' : '#6b7280' }}
      >
        {apt.trainingType.name}
      </div>
    </div>
  );
}

// Droppable Time Slot Component
function DroppableTimeSlot({
  id,
  hour,
  children,
  onClick,
}: {
  id: string;
  hour: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'absolute left-0 right-0 h-[60px] border-b border-gray-100 transition-colors',
        isOver ? 'bg-primary-100/50' : 'hover:bg-primary-50/30'
      )}
      style={{ top: `${(hour - 6) * 60}px` }}
      onClick={onClick}
    >
      {/* Quarter hour lines */}
      <div className="absolute left-0 right-0 top-[15px] border-b border-gray-50" />
      <div className="absolute left-0 right-0 top-[30px] border-b border-gray-50" />
      <div className="absolute left-0 right-0 top-[45px] border-b border-gray-50" />
      {children}
    </div>
  );
}

// External iCal Event Component (non-draggable)
function ExternalEvent({
  event,
  style,
}: {
  event: ICalEvent;
  style: React.CSSProperties;
}) {
  // Check if event is in the past
  const isPast = new Date(event.endTime) < new Date();

  // Check if this has overlap positioning (has explicit left/width)
  const hasOverlapStyle = 'left' in style && 'width' in style;

  return (
    <div
      className={clsx(
        "absolute rounded-lg px-2 py-1 text-left overflow-hidden border-l-4 z-5",
        !hasOverlapStyle && "left-1 right-1"
      )}
      style={{
        ...style,
        backgroundColor: '#f3f4f6',
        borderLeftColor: '#9ca3af',
        opacity: isPast ? 0.5 : 0.7,
      }}
    >
      <div className="text-xs font-semibold truncate text-gray-500">
        {format(new Date(event.startTime), 'HH:mm')} - {format(new Date(event.endTime), 'HH:mm')}
      </div>
      <div className="text-xs font-medium truncate text-gray-700">
        {event.title}
      </div>
      <div className="text-xs truncate text-gray-400">
        Externe kalender
      </div>
    </div>
  );
}

// Drag Overlay Preview
function AppointmentDragPreview({ apt }: { apt: Appointment }) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-left overflow-hidden shadow-xl border-l-4 w-48"
      style={{
        backgroundColor: `${apt.trainer.color}30`,
        borderLeftColor: apt.trainer.color,
      }}
    >
      <div className="text-xs font-semibold" style={{ color: apt.trainer.color }}>
        {format(new Date(apt.startTime), 'HH:mm')} - {format(new Date(apt.endTime), 'HH:mm')}
      </div>
      <div className="text-sm font-medium text-gray-900 truncate">
        {apt.participants.map((p) => p.name).join(', ')}
      </div>
      <div className="text-xs text-gray-500">
        {apt.trainingType.name}
      </div>
    </div>
  );
}

type ViewMode = 'day' | 'week';

// Hook to detect mobile screen
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export default function CalendarPage() {
  const isMobile = useIsMobile();

  const [currentDate, setCurrentDate] = useState(new Date());
  // View mode: default based on screen size, but can be toggled
  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null);
  const viewMode: ViewMode = viewModeOverride ?? (isMobile ? 'day' : 'week');
  const [selectedTrainers, setSelectedTrainers] = useState<string[]>([]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [createInitialData, setCreateInitialData] = useState<{ date?: Date; startTime?: string } | null>(null);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const queryClient = useQueryClient();

  // Setup drag sensors - only on desktop (no touch drag on mobile)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }, // 8px before drag starts
  });
  // Only use pointer sensor on desktop, disable drag & drop on mobile
  const sensors = useSensors(isMobile ? undefined : pointerSensor);


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

  // Fetch external iCal events
  const { data: icalEvents = [] } = useQuery<ICalEvent[]>({
    queryKey: ['ical-events', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () => calendarApi.getEvents(weekStart.toISOString(), weekEnd.toISOString()),
  });

  // Mutation for updating appointment time via drag & drop
  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, startTime, endTime }: { id: string; startTime: string; endTime: string }) =>
      appointmentsApi.update(id, { startTime, endTime }),
    onMutate: async ({ id, startTime, endTime }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['appointments'] });

      // Snapshot previous value
      const previousAppointments = queryClient.getQueryData(['appointments', weekStart.toISOString(), weekEnd.toISOString()]);

      // Optimistically update
      queryClient.setQueryData(
        ['appointments', weekStart.toISOString(), weekEnd.toISOString()],
        (old: Appointment[] | undefined) =>
          old?.map(apt => apt.id === id ? { ...apt, startTime, endTime } : apt) ?? []
      );

      return { previousAppointments };
    },
    onError: (err: any, _variables, context) => {
      // Rollback on error
      if (context?.previousAppointments) {
        queryClient.setQueryData(
          ['appointments', weekStart.toISOString(), weekEnd.toISOString()],
          context.previousAppointments
        );
      }
      const data = err?.response?.data;
      const errorMsg = data?.error || data?.details?.[0]?.message || err?.message || 'Onbekende fout';
      alert(`Kon afspraak niet verplaatsen: ${errorMsg}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  // Initialize selected trainers when trainers load
  useMemo(() => {
    if (trainers.length > 0 && selectedTrainers.length === 0) {
      setSelectedTrainers(trainers.map((t: any) => t.id));
    }
  }, [trainers]);

  // Days to display based on view mode (not screen size)
  const days = viewMode === 'day'
    ? [currentDate] // Single day view
    : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); // Week view

  // Expand recurring appointments within the visible range
  const expandedAppointments = useMemo(() => {
    return expandRecurringAppointments(appointments, weekStart, weekEnd);
  }, [appointments, weekStart, weekEnd]);

  const filteredAppointments = expandedAppointments.filter(
    (apt) =>
      selectedTrainers.length === 0 || selectedTrainers.includes(apt.trainer.id)
  );

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const apt = filteredAppointments.find((a) => a.id === active.id);
    if (apt) {
      setActiveAppointment(apt);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAppointment(null);

    if (!over || !active.id) return;

    // Parse droppable ID: "slot-{dayIndex}-{hour}"
    const match = over.id.toString().match(/^slot-(\d+)-(\d+)$/);
    if (!match) return;

    const dayIndex = parseInt(match[1], 10);
    const hour = parseInt(match[2], 10);

    const apt = filteredAppointments.find((a) => a.id === active.id);
    if (!apt) return;

    // For recurring instances, get the original appointment ID
    const appointmentId = apt.recurrenceId || apt.id;

    // Calculate new times
    const oldStart = new Date(apt.startTime);
    const oldEnd = new Date(apt.endTime);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    // Get the target day
    const targetDay = addDays(weekStart, dayIndex);
    const newStart = setMinutes(setHours(targetDay, hour), 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Only update if time actually changed
    if (newStart.getTime() !== oldStart.getTime()) {
      // Note: Moving a recurring instance will update the original appointment
      // This might not be the desired behavior for all cases
      updateAppointmentMutation.mutate({
        id: appointmentId,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      });
    }
  };

  const handleDragCancel = () => {
    setActiveAppointment(null);
  };

  const toggleTrainer = (trainerId: string) => {
    setSelectedTrainers((prev) =>
      prev.includes(trainerId)
        ? prev.filter((id) => id !== trainerId)
        : [...prev, trainerId]
    );
  };

  // Calculate positions for overlapping appointments (side-by-side layout)
  const calculateOverlapPositions = (appointments: (Appointment | ICalEvent)[]): Map<string, { column: number; totalColumns: number }> => {
    const positions = new Map<string, { column: number; totalColumns: number }>();

    if (appointments.length === 0) return positions;

    // Sort by start time, then by end time
    const sorted = [...appointments].sort((a, b) => {
      const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      if (startDiff !== 0) return startDiff;
      return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
    });

    // Track columns: each column has the end time of its last appointment
    const columns: number[] = [];

    for (const apt of sorted) {
      const aptStart = new Date(apt.startTime).getTime();
      const aptEnd = new Date(apt.endTime).getTime();

      // Find first column where this appointment fits (no overlap)
      let column = columns.findIndex(colEnd => aptStart >= colEnd);

      if (column === -1) {
        // No column available, create new one
        column = columns.length;
        columns.push(aptEnd);
      } else {
        // Use existing column
        columns[column] = aptEnd;
      }

      positions.set(apt.id, { column, totalColumns: 0 }); // totalColumns set later
    }

    // Calculate max columns for overlapping groups
    for (const apt of sorted) {
      const aptStart = new Date(apt.startTime).getTime();
      const aptEnd = new Date(apt.endTime).getTime();

      // Find all appointments that overlap with this one
      const overlapping = sorted.filter(other => {
        const otherStart = new Date(other.startTime).getTime();
        const otherEnd = new Date(other.endTime).getTime();
        return aptStart < otherEnd && aptEnd > otherStart;
      });

      // Get max column number among overlapping appointments
      const maxColumn = Math.max(...overlapping.map(o => positions.get(o.id)?.column ?? 0));
      const totalColumns = maxColumn + 1;

      // Update all overlapping appointments with the correct totalColumns
      for (const o of overlapping) {
        const pos = positions.get(o.id);
        if (pos && pos.totalColumns < totalColumns) {
          positions.set(o.id, { ...pos, totalColumns });
        }
      }
    }

    return positions;
  };

  // Memoize overlap positions per day
  const getOverlapPositionsForDay = useMemo(() => {
    const cache = new Map<string, Map<string, { column: number; totalColumns: number }>>();

    return (day: Date, dayAppointments: (Appointment | ICalEvent)[]) => {
      const dayKey = day.toISOString().split('T')[0];
      if (!cache.has(dayKey)) {
        cache.set(dayKey, calculateOverlapPositions(dayAppointments));
      }
      return cache.get(dayKey)!;
    };
  }, [filteredAppointments, icalEvents]);

  const getAppointmentStyle = (apt: Appointment | ICalEvent, day: Date, dayAppointments: (Appointment | ICalEvent)[]) => {
    const start = new Date(apt.startTime);
    const end = new Date(apt.endTime);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    const top = (startHour - 6) * 60; // 60px per hour
    const height = Math.max((endHour - startHour) * 60, 30); // Min height 30px

    // Get overlap position for side-by-side layout
    const positions = getOverlapPositionsForDay(day, dayAppointments);
    const pos = positions.get(apt.id);

    if (pos && pos.totalColumns > 1) {
      const totalColumns = pos.totalColumns;
      const paddingPx = 4; // 4px padding (matches left-1/right-1 = 0.25rem)
      const gapPx = 2; // 2px gap between columns
      const columnWidthPercent = 100 / totalColumns;

      // Calculate left position with padding
      const leftCalc = pos.column === 0
        ? `${paddingPx}px` // First column: just padding
        : `calc(${pos.column * columnWidthPercent}% + ${gapPx / 2}px)`;

      // Calculate width with padding/gap
      const widthCalc = pos.column === totalColumns - 1
        ? `calc(${columnWidthPercent}% - ${paddingPx + gapPx / 2}px)` // Last column
        : pos.column === 0
          ? `calc(${columnWidthPercent}% - ${paddingPx + gapPx / 2}px)` // First column
          : `calc(${columnWidthPercent}% - ${gapPx}px)`; // Middle columns

      return {
        top: `${top}px`,
        height: `${height}px`,
        left: leftCalc,
        width: widthCalc,
      };
    }

    return { top: `${top}px`, height: `${height}px` };
  };

  // Touch handlers for swipe navigation
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
        // Swipe left - next day/week based on view mode
        setCurrentDate(viewMode === 'day' ? addDays(currentDate, 1) : addWeeks(currentDate, 1));
      } else {
        // Swipe right - previous day/week based on view mode
        setCurrentDate(viewMode === 'day' ? subDays(currentDate, 1) : subWeeks(currentDate, 1));
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
    setEditingAppointment(null);
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
                onClick={() => setCurrentDate(viewMode === 'day' ? subDays(currentDate, 1) : subWeeks(currentDate, 1))}
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
                  {viewMode === 'day'
                    ? format(currentDate, 'd MMMM', { locale: nl })
                    : format(currentDate, 'MMMM yyyy', { locale: nl })}
                </span>
                <CalendarIcon className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => setCurrentDate(viewMode === 'day' ? addDays(currentDate, 1) : addWeeks(currentDate, 1))}
                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                Vandaag
              </button>

              {/* View toggle */}
              <button
                onClick={() => setViewModeOverride(viewMode === 'day' ? 'week' : 'day')}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {viewMode === 'day' ? 'Week' : 'Dag'}
              </button>
            </div>
          </div>
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

      {/* Calendar Grid with Drag & Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={calendarRef}
          className="flex-1 overflow-auto bg-white"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex min-h-full">
            {/* Time column */}
            <div className="w-12 lg:w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50">
              {viewMode === 'week' && <div className="h-12 lg:h-14 border-b border-gray-200" />}
              <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
                {HOURS.map((hour, index) => (
                  <div
                    key={hour}
                    className="absolute right-0 pr-2 text-xs text-gray-400 -translate-y-1/2"
                    style={{ top: `${index * 60}px` }}
                  >
                    {hour}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Days */}
            <div className={clsx('flex-1', viewMode === 'week' && 'grid grid-cols-7')}>
              {days.map((day, dayIndex) => {
                // For day view, calculate the actual day index relative to week start
                const actualDayIndex = viewMode === 'day'
                  ? Math.floor((day.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
                  : dayIndex;

                return (
                  <div
                    key={dayIndex}
                    className={clsx(
                      'border-r border-gray-200 last:border-r-0 min-w-0',
                      viewMode === 'week' && (dayIndex === 5 || dayIndex === 6) && 'bg-gray-50/50'
                    )}
                  >
                    {/* Day header - only in week view */}
                    {viewMode === 'week' && (
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
                      {/* Droppable time slots */}
                      {HOURS.map((hour) => (
                        <DroppableTimeSlot
                          key={`slot-${actualDayIndex}-${hour}`}
                          id={`slot-${actualDayIndex}-${hour}`}
                          hour={hour}
                          onClick={() => handleTimeSlotClick(day, hour)}
                        >
                          {null}
                        </DroppableTimeSlot>
                      ))}

                      {/* Current time indicator (Amsterdam timezone) */}
                      {isToday(day) && (() => {
                        const { hours, minutes } = getAmsterdamTime();
                        return (
                          <div
                            className="absolute left-0 right-0 z-20 pointer-events-none"
                            style={{
                              top: `${(hours + minutes / 60 - 6) * 60}px`,
                            }}
                          >
                            <div className="relative">
                              <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                              <div className="h-0.5 bg-red-500" />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Draggable Appointments & External iCal Events (with overlap handling) */}
                      {(() => {
                        const dayAppointments = filteredAppointments.filter((apt) => isSameDay(new Date(apt.startTime), day));
                        const dayIcalEvents = icalEvents.filter((event) => isSameDay(new Date(event.startTime), day));
                        const allDayEvents: (Appointment | ICalEvent)[] = [...dayAppointments, ...dayIcalEvents];

                        return (
                          <>
                            {dayAppointments.map((apt) => (
                              <DraggableAppointment
                                key={apt.id}
                                apt={apt}
                                style={getAppointmentStyle(apt, day, allDayEvents)}
                                onClick={() => handleAppointmentClick(apt)}
                              />
                            ))}
                            {dayIcalEvents.map((event) => (
                              <ExternalEvent
                                key={event.id}
                                event={event}
                                style={getAppointmentStyle(event, day, allDayEvents)}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeAppointment && <AppointmentDragPreview apt={activeAppointment} />}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      <AppointmentModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateInitialData(null);
          setEditingAppointment(null);
        }}
        onSuccess={() => {
          refetchAppointments();
          setIsCreateModalOpen(false);
          setCreateInitialData(null);
          setEditingAppointment(null);
        }}
        initialData={createInitialData}
        editingAppointment={editingAppointment}
      />

      <AppointmentDetailModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onEdit={() => {
          if (selectedAppointment) {
            setEditingAppointment(selectedAppointment);
            setIsCreateModalOpen(true);
            setSelectedAppointment(null);
          }
        }}
        onDelete={() => {
          refetchAppointments();
          setSelectedAppointment(null);
        }}
      />
    </div>
  );
}
