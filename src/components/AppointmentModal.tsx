import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, User, Users, Loader2 } from 'lucide-react';
import { appointmentsApi, trainersApi, participantsApi, trainingTypesApi } from '../lib/api';
import clsx from 'clsx';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: { date?: Date; startTime?: string } | null;
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
  const [error, setError] = useState('');

  const { data: trainingTypes = [] } = useQuery({
    queryKey: ['training-types'],
    queryFn: trainingTypesApi.getAll,
    enabled: isOpen,
  });

  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers'],
    queryFn: trainersApi.getAll,
    enabled: isOpen,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['participants'],
    queryFn: () => participantsApi.getAll(),
    enabled: isOpen,
  });

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

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, initialData, trainingTypes, trainers]);

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
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedType || !selectedTrainer || selectedParticipants.length === 0) {
      setError('Vul alle verplichte velden in');
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (endDateTime <= startDateTime) {
      setError('Eindtijd moet na starttijd zijn');
      return;
    }

    createMutation.mutate({
      trainingTypeId: selectedType,
      trainerId: selectedTrainer,
      participantIds: selectedParticipants,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      notes: notes || undefined,
      isRecurring,
      recurrenceRule: isRecurring ? recurrenceRule : undefined,
    });
  };

  const selectedTypeData = trainingTypes.find((t: any) => t.id === selectedType);
  const maxParticipants = selectedTypeData?.maxParticipants || 1;

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
          <h2 className="text-lg font-semibold">Nieuwe Afspraak</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {/* Training Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type Training *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {trainingTypes.map((type: any) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setSelectedType(type.id);
                    // Reset participants if max changed
                    if (type.maxParticipants < selectedParticipants.length) {
                      setSelectedParticipants([]);
                    }
                  }}
                  className={clsx(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors',
                    selectedType === type.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trainer *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {trainers.map((trainer: any) => (
                <button
                  key={trainer.id}
                  type="button"
                  onClick={() => setSelectedTrainer(trainer.id)}
                  className={clsx(
                    'flex items-center gap-2 p-3 rounded-lg border-2 transition-colors',
                    selectedTrainer === trainer.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                    style={{ backgroundColor: trainer.color }}
                  >
                    {trainer.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium truncate">
                    {trainer.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deelnemer{maxParticipants > 1 ? 's' : ''} * ({selectedParticipants.length}/{maxParticipants})
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {participants.map((participant: any) => (
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
                    onChange={() => toggleParticipant(participant.id)}
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
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start *
              </label>
              <select
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  // Auto-update end time
                  const [h, m] = e.target.value.split(':').map(Number);
                  const endHour = h + 1;
                  if (endHour <= 21) {
                    setEndTime(`${endHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Eind *
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurrence */}
          <div>
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
              <select
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                <option value="daily">Dagelijks</option>
                <option value="weekly">Wekelijks</option>
                <option value="biweekly">Om de week</option>
                <option value="monthly">Maandelijks</option>
              </select>
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
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium"
          >
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
