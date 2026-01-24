import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { X, User, Calendar, Euro, Repeat, Trash2, Pencil, Loader2 } from 'lucide-react';
import { appointmentsApi } from '../lib/api';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  trainer: { id: string; name: string; color: string; hourlyRate?: number };
  trainingType: { id: string; name: string; defaultRate?: number };
  participants: { id: string; name: string; email: string }[];
}

interface AppointmentDetailModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function AppointmentDetailModal({
  appointment,
  onClose,
  onEdit,
  onDelete,
}: AppointmentDetailModalProps) {
  const deleteMutation = useMutation({
    mutationFn: (deleteSeries: boolean) => appointmentsApi.delete(appointment!.id, deleteSeries),
    onSuccess: () => {
      onDelete();
    },
  });

  if (!appointment) return null;

  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const durationHours = durationMinutes / 60;

  const hourlyRate = appointment.trainer.hourlyRate || appointment.trainingType.defaultRate || 45;
  const totalCost = durationHours * Number(hourlyRate);

  const handleDelete = () => {
    const isPast = end < new Date();

    // Warning for past appointments
    if (isPast) {
      const confirmPast = confirm(
        '⚠️ Let op: Deze afspraak ligt in het verleden.\n\n' +
        'Het verwijderen kan invloed hebben op facturatie en rapportages.\n\n' +
        'Weet je zeker dat je wilt doorgaan?'
      );
      if (!confirmPast) return;
    }

    if (appointment.isRecurring) {
      const deleteSeries = confirm(
        'Wil je de hele serie verwijderen? Klik op Annuleren om alleen deze afspraak te verwijderen.'
      );
      deleteMutation.mutate(deleteSeries);
    } else {
      if (isPast || confirm('Weet je zeker dat je deze afspraak wilt verwijderen?')) {
        deleteMutation.mutate(false);
      }
    }
  };

  const recurrenceLabel = {
    daily: 'Dagelijks',
    weekly: 'Wekelijks',
    biweekly: 'Om de week',
    monthly: 'Maandelijks',
  }[appointment.recurrenceRule || ''];

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full lg:max-w-md lg:rounded-xl rounded-t-xl overflow-hidden">
        {/* Header with trainer color */}
        <div
          className="px-4 py-4"
          style={{ backgroundColor: `${appointment.trainer.color}15` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <span
                className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium mb-2"
                style={{
                  backgroundColor: `${appointment.trainer.color}30`,
                  color: appointment.trainer.color,
                }}
              >
                {appointment.trainingType.name}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">
                {appointment.participants.map((p) => p.name).join(', ')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 space-y-4">
          {/* Trainer */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: appointment.trainer.color }}
            >
              {appointment.trainer.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-gray-900">{appointment.trainer.name}</p>
              <p className="text-sm text-gray-500">Trainer</p>
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {format(start, 'EEEE d MMMM yyyy', { locale: nl })}
              </p>
              <p className="text-sm text-gray-500">
                {format(start, 'HH:mm')} - {format(end, 'HH:mm')} ({Math.round(durationMinutes)} min)
              </p>
            </div>
          </div>

          {/* Recurrence */}
          {appointment.isRecurring && recurrenceLabel && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{recurrenceLabel}</p>
                <p className="text-sm text-gray-500">Herhalende afspraak</p>
              </div>
            </div>
          )}

          {/* Cost */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
              <Euro className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {totalCost.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-sm text-gray-500">
                {Number(hourlyRate).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}/uur
              </p>
            </div>
          </div>

          {/* Participants */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-1">Deelnemers</p>
              <div className="space-y-1">
                {appointment.participants.map((p) => (
                  <div key={p.id} className="text-sm text-gray-600">
                    {p.name}
                    <span className="text-gray-400 ml-1">({p.email})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">{appointment.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 bg-white border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-200 active:bg-red-100 transition-colors font-medium"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Verwijderen
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium"
          >
            Sluiten
          </button>
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 transition-colors font-medium"
          >
            <Pencil className="w-4 h-4" />
            Bewerken
          </button>
        </div>
      </div>
    </div>
  );
}
