import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { X, User, Users, Loader2, Clock, Search } from 'lucide-react';
import { appointmentsApi, trainersApi, participantsApi, trainingTypesApi } from '../lib/api';
import clsx from 'clsx';

interface EditingAppointment {
  id: string;
  startTime: string;
  endTime: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  recurrenceId?: string; // Original appointment ID for recurring instances
  trainer: { id: string };
  trainingType: { id: string };
  participants: { id: string }[];
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: { date?: Date; startTime?: string } | null;
  editingAppointment?: EditingAppointment | null;
}

const TIME_OPTIONS = Array.from({ length: 60 }, (_, i) => {
  const hour = Math.floor(i / 4) + 6;
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

export default function AppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  editingAppointment,
}: AppointmentModalProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedTrainer, setSelectedTrainer] = useState<string>('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState('weekly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [error, setError] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState<'single' | 'series' | null>(null);
  const [showEditModeChoice, setShowEditModeChoice] = useState(false);

  const { data: trainingTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ['training-types'],
    queryFn: trainingTypesApi.getAll,
    enabled: isOpen,
  });

  const { data: trainers = [], isLoading: loadingTrainers } = useQuery({
    queryKey: ['trainers'],
    queryFn: trainersApi.getAll,
    enabled: isOpen,
  });

  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ['participants'],
    queryFn: () => participantsApi.getAll(),
    enabled: isOpen,
  });

  const isLoading = loadingTypes || loadingTrainers || loadingParticipants;

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      onSuccess();
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Er is een fout opgetreden');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof appointmentsApi.update>[1] }) =>
      appointmentsApi.update(id, data),
    onSuccess: () => {
      onSuccess();
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Er is een fout opgetreden');
    },
  });

  // Reset edit mode when modal closes or appointment changes
  useEffect(() => {
    if (!isOpen) {
      // Reset when modal closes
      setEditMode(null);
      setShowEditModeChoice(false);
    }
  }, [isOpen]);

  // Reset edit mode when switching to a different appointment
  useEffect(() => {
    setEditMode(null);
    setShowEditModeChoice(false);
  }, [editingAppointment?.id]);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      // If editing, load existing appointment data
      if (editingAppointment) {
        // Show choice dialog for recurring appointments
        if (editingAppointment.isRecurring && !editMode) {
          setShowEditModeChoice(true);
          return; // Don't load form data yet
        }

        const start = new Date(editingAppointment.startTime);
        const end = new Date(editingAppointment.endTime);
        setDate(format(start, 'yyyy-MM-dd'));
        setStartTime(format(start, 'HH:mm'));
        setEndTime(format(end, 'HH:mm'));
        setSelectedType(editingAppointment.trainingType.id);
        setSelectedTrainer(editingAppointment.trainer.id);
        setSelectedParticipants(editingAppointment.participants.map(p => p.id));
        setNotes(editingAppointment.notes || '');

        // For single instance edit, don't show recurrence options
        if (editMode === 'single') {
          setIsRecurring(false);
          setRecurrenceRule('weekly');
          setRecurrenceEndDate('');
        } else {
          setIsRecurring(editingAppointment.isRecurring || false);
          setRecurrenceRule(editingAppointment.recurrenceRule || 'weekly');
          setRecurrenceEndDate(editingAppointment.recurrenceEndDate ? format(new Date(editingAppointment.recurrenceEndDate), 'yyyy-MM-dd') : '');
        }
      } else {
        // New appointment
        if (initialData?.date) {
          setDate(format(initialData.date, 'yyyy-MM-dd'));
        }
        if (initialData?.startTime) {
          setStartTime(initialData.startTime);
          // Calculate end time (1 hour later)
          const [h, m] = initialData.startTime.split(':').map(Number);
          const endHour = h + 1;
          setEndTime(`${endHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
        // Set first training type as default
        if (trainingTypes.length > 0 && !selectedType) {
          setSelectedType(trainingTypes[0].id);
        }
        // Set first trainer as default
        if (trainers.length > 0 && !selectedTrainer) {
          setSelectedTrainer(trainers[0].id);
        }
      }
    }
  }, [isOpen, initialData, editingAppointment, editMode, trainingTypes, trainers]);

  const resetForm = () => {
    setSelectedType('');
    setSelectedTrainer('');
    setSelectedParticipants([]);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('09:00');
    setEndTime('10:00');
    setNotes('');
    setIsRecurring(false);
    setRecurrenceRule('weekly');
    setRecurrenceEndDate('');
    setError('');
    setParticipantSearch('');
    setTouched({});
    setEditMode(null);
    setShowEditModeChoice(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Mark all fields as touched to show validation
    setTouched({ type: true, trainer: true, participants: true, time: true });

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      setError(Object.values(validationErrors)[0]);
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    const appointmentData = {
      trainingTypeId: selectedType,
      trainerId: selectedTrainer,
      participantIds: selectedParticipants,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      notes: notes || undefined,
      isRecurring,
      recurrenceRule: isRecurring ? recurrenceRule : undefined,
      recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : undefined,
    };

    if (editingAppointment) {
      if (editMode === 'single') {
        // Create a new standalone appointment for this single instance
        createMutation.mutate(appointmentData);
      } else {
        // Update the series - use recurrenceId if this is a virtual instance
        const originalId = editingAppointment.recurrenceId || editingAppointment.id;
        updateMutation.mutate({ id: originalId, data: appointmentData });
      }
    } else {
      createMutation.mutate(appointmentData);
    }
  };

  const selectedTypeData = trainingTypes.find((t: any) => t.id === selectedType);
  const maxParticipants = selectedTypeData?.maxParticipants || 1;

  // Calculate duration
  const duration = useMemo(() => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const diffMinutes = endMinutes - startMinutes;
    if (diffMinutes <= 0) return null;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} uur`;
    return `${hours}u ${mins}m`;
  }, [startTime, endTime]);

  // Filter participants by search
  const filteredParticipants = useMemo(() => {
    if (!participantSearch.trim()) return participants;
    const search = participantSearch.toLowerCase();
    return participants.filter((p: any) =>
      p.name.toLowerCase().includes(search) ||
      p.email.toLowerCase().includes(search)
    );
  }, [participants, participantSearch]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!selectedType) errors.type = 'Selecteer een type training';
    if (!selectedTrainer) errors.trainer = 'Selecteer een trainer';
    if (selectedParticipants.length === 0) errors.participants = 'Selecteer minimaal 1 deelnemer';
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (endH * 60 + endM <= startH * 60 + startM) errors.time = 'Eindtijd moet na starttijd zijn';
    return errors;
  }, [selectedType, selectedTrainer, selectedParticipants, startTime, endTime]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= maxParticipants) {
        return prev;
      }
      return [...prev, id];
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full lg:max-w-lg lg:rounded-xl rounded-t-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold">
            {editingAppointment ? 'Bewerken' : 'Nieuwe afspraak'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Edit mode choice for recurring appointments */}
          {showEditModeChoice && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Dit is een herhalende afspraak. Wat wil je bewerken?
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditMode('single');
                    setShowEditModeChoice(false);
                  }}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <p className="font-medium text-gray-900">Alleen deze afspraak</p>
                  <p className="text-sm text-gray-500">Maak een uitzondering voor alleen dit moment</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode('series');
                    setShowEditModeChoice(false);
                  }}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <p className="font-medium text-gray-900">Alle afspraken in de reeks</p>
                  <p className="text-sm text-gray-500">Wijzig de herhalende afspraak en alle toekomstige momenten</p>
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {!showEditModeChoice && isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              <span className="ml-2 text-gray-500">Laden...</span>
            </div>
          )}

          {!showEditModeChoice && !isLoading && (
            <>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              {/* Training Type */}
              <div>
                <label className={clsx(
                  "block text-sm font-medium mb-2",
                  touched.type && validationErrors.type ? "text-red-600" : "text-gray-700"
                )}>
                  Type Training *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {trainingTypes.map((type: any) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(type.id);
                        setTouched(t => ({ ...t, type: true }));
                        // Reset participants if max changed
                        if (type.maxParticipants < selectedParticipants.length) {
                          setSelectedParticipants([]);
                        }
                      }}
                      className={clsx(
                        'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                        selectedType === type.id
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : touched.type && validationErrors.type
                            ? 'border-red-200 hover:border-red-300'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${type.color}20`, color: type.color }}
                      >
                        {type.maxParticipants === 1 ? (
                          <User className="w-5 h-5" />
                        ) : (
                          <Users className="w-5 h-5" />
                        )}
                      </div>
                      <span className="text-xs font-medium text-center">{type.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trainer */}
              <div>
                <label className={clsx(
                  "block text-sm font-medium mb-2",
                  touched.trainer && validationErrors.trainer ? "text-red-600" : "text-gray-700"
                )}>
                  Trainer *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {trainers.map((trainer: any) => (
                    <button
                      key={trainer.id}
                      type="button"
                      onClick={() => {
                        setSelectedTrainer(trainer.id);
                        setTouched(t => ({ ...t, trainer: true }));
                      }}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                        selectedTrainer === trainer.id
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : touched.trainer && validationErrors.trainer
                            ? 'border-red-200 hover:border-red-300'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: trainer.color }}
                      >
                        {trainer.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium truncate">
                        {trainer.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Participants */}
              <div>
                <label className={clsx(
                  "block text-sm font-medium mb-2",
                  touched.participants && validationErrors.participants ? "text-red-600" : "text-gray-700"
                )}>
                  Deelnemer{maxParticipants > 1 ? 's' : ''} * ({selectedParticipants.length}/{maxParticipants})
                </label>

                {/* Search input - text-base (16px) prevents iOS zoom on focus */}
                {participants.length > 5 && (
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder="Zoek deelnemer..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>
                )}

                <div className={clsx(
                  "max-h-40 overflow-y-auto border rounded-lg divide-y divide-gray-100",
                  touched.participants && validationErrors.participants ? "border-red-200" : "border-gray-200"
                )}>
                  {filteredParticipants.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      {participantSearch ? 'Geen resultaten gevonden' : 'Geen deelnemers beschikbaar'}
                    </div>
                  ) : (
                    filteredParticipants.map((participant: any) => (
                      <label
                        key={participant.id}
                        className={clsx(
                          'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                          selectedParticipants.includes(participant.id)
                            ? 'bg-primary-50'
                            : 'hover:bg-gray-50',
                          !selectedParticipants.includes(participant.id) &&
                            selectedParticipants.length >= maxParticipants &&
                            'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedParticipants.includes(participant.id)}
                          onChange={() => {
                            toggleParticipant(participant.id);
                            setTouched(t => ({ ...t, participants: true }));
                          }}
                          disabled={
                            !selectedParticipants.includes(participant.id) &&
                            selectedParticipants.length >= maxParticipants
                          }
                          className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {participant.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{participant.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Date and Time - compact single row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Datum & Tijd *
                  </label>
                  {duration && (
                    <span className="flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {duration}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-[2] min-w-0 px-2 h-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  />
                  <select
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setTouched(t => ({ ...t, time: true }));
                      const [h, m] = e.target.value.split(':').map(Number);
                      const endHour = h + 1;
                      if (endHour <= 21) {
                        setEndTime(`${endHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                      }
                    }}
                    className={clsx(
                      "flex-1 min-w-0 px-1.5 h-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm",
                      touched.time && validationErrors.time ? "border-red-300" : "border-gray-300"
                    )}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <span className="text-gray-400 text-sm">-</span>
                  <select
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setTouched(t => ({ ...t, time: true }));
                    }}
                    className={clsx(
                      "flex-1 min-w-0 px-1.5 h-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm",
                      touched.time && validationErrors.time ? "border-red-300" : "border-gray-300"
                    )}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recurrence */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Herhalende afspraak</span>
                </label>
                {isRecurring && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Herhaling</label>
                        <select
                          value={recurrenceRule}
                          onChange={(e) => setRecurrenceRule(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                        >
                          <option value="daily">Dagelijks</option>
                          <option value="weekly">Wekelijks</option>
                          <option value="biweekly">Om de week</option>
                          <option value="monthly">Maandelijks</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tot en met</label>
                        <input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          min={date}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {recurrenceEndDate
                        ? `Herhaalt ${recurrenceRule === 'daily' ? 'dagelijks' : recurrenceRule === 'weekly' ? 'wekelijks' : recurrenceRule === 'biweekly' ? 'om de week' : 'maandelijks'} tot ${format(new Date(recurrenceEndDate), 'd MMMM yyyy', { locale: nl })}`
                        : 'Geen einddatum ingesteld - herhaalt onbeperkt'}
                    </p>
                  </>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notities
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optionele notities..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm resize-none"
                />
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              "px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium",
              showEditModeChoice ? "flex-1" : "flex-1"
            )}
          >
            Annuleren
          </button>
          {!showEditModeChoice && (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || isLoading}
              className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingAppointment ? (editMode === 'single' ? 'Opslaan als nieuwe' : 'Bijwerken') : 'Opslaan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
