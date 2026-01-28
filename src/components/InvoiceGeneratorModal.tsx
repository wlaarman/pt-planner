import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { invoicesApi } from '../lib/api';
import clsx from 'clsx';

interface BillableAppointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  trainer: { id: string; name: string; hourlyRate: number | null };
  trainingType: { id: string; name: string; defaultRate: number | null };
  rate: number;
  amount: number;
}

interface TrainingTypeGroup {
  trainingType: { id: string; name: string; defaultRate?: number | null };
  appointments: BillableAppointment[];
  totalMinutes: number;
  totalHours: number;
  totalAmount: number;
}

interface BillableParticipant {
  id: string;
  name: string;
  email: string;
  appointments: BillableAppointment[];
  byTrainingType: TrainingTypeGroup[];
  totalMinutes: number;
  totalHours: number;
  totalAmount: number;
}

interface BillableData {
  participants: BillableParticipant[];
  summary: {
    totalParticipants: number;
    totalHours: number;
    totalAmount: number;
    byTrainingType?: Array<{
      trainingType: { id: string; name: string };
      totalHours: number;
      totalAmount: number;
    }>;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  billableData: BillableData | null;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
}

export default function InvoiceGeneratorModal({
  isOpen,
  onClose,
  billableData,
  periodStart,
  periodEnd,
  periodLabel,
}: Props) {
  const queryClient = useQueryClient();
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [taxRate, setTaxRate] = useState(21);
  const [dueDays, setDueDays] = useState(14);

  // Initialize selected participants when data loads
  useEffect(() => {
    if (billableData?.participants) {
      setSelectedParticipants(new Set(billableData.participants.map((p) => p.id)));
    }
  }, [billableData]);

  const generateMutation = useMutation({
    mutationFn: () =>
      invoicesApi.generate({
        participantIds: Array.from(selectedParticipants),
        periodStart,
        periodEnd,
        taxRate,
        dueDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      queryClient.invalidateQueries({ queryKey: ['billable'] });
      onClose();
    },
  });

  if (!isOpen || !billableData) return null;

  const toggleParticipant = (id: string) => {
    const newSet = new Set(selectedParticipants);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedParticipants(newSet);
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedParticipants);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedParticipants(newSet);
  };

  const selectedData = billableData.participants.filter((p) => selectedParticipants.has(p.id));
  const totalAmount = selectedData.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalWithTax = totalAmount * (1 + taxRate / 100);

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h}u`;
    return `${h}u ${m}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Facturen Genereren</h2>
            <p className="text-sm text-gray-500 mt-1">{periodLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {billableData.participants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Geen factureerbare afspraken gevonden voor deze periode.</p>
              <p className="text-sm mt-2">
                Let op: geannuleerde afspraken worden niet getoond.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {billableData.participants.map((participant) => {
                const isSelected = selectedParticipants.has(participant.id);
                const isExpanded = expandedParticipants.has(participant.id);

                return (
                  <div
                    key={participant.id}
                    className={clsx(
                      'border rounded-xl transition-colors',
                      isSelected
                        ? 'border-primary-200 bg-primary-50/50'
                        : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    {/* Participant Header */}
                    <div className="flex items-center gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleParticipant(participant.id)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                      <button
                        onClick={() => toggleExpanded(participant.id)}
                        className="flex-1 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{participant.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {participant.byTrainingType?.map((t) => (
                                <span key={t.trainingType.id} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {t.trainingType.name}: {t.totalHours.toFixed(1)}u
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(participant.totalAmount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDuration(participant.totalMinutes)}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Expanded - grouped by training type */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 px-4 py-3 space-y-4">
                        {participant.byTrainingType?.map((typeGroup) => (
                          <div key={typeGroup.trainingType.id}>
                            <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-700">
                                {typeGroup.trainingType.name}
                              </span>
                              <span className="text-sm font-semibold text-gray-700">
                                {typeGroup.totalHours.toFixed(1)}u - {formatCurrency(typeGroup.totalAmount)}
                              </span>
                            </div>
                            {typeGroup.appointments.map((apt) => (
                              <div
                                key={apt.id}
                                className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-white/50"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500 w-20">{apt.date}</span>
                                  <span className="text-gray-400">
                                    {apt.startTime} - {apt.endTime}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-gray-600">
                                  <span>{formatDuration(apt.duration)}</span>
                                  <span className="w-20 text-right">{formatCurrency(apt.amount)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {billableData.participants.length > 0 && (
          <div className="border-t border-gray-200 p-6">
            {/* Options */}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">BTW tarief:</label>
                <select
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={0}>0%</option>
                  <option value={9}>9%</option>
                  <option value={21}>21%</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Vervaldatum:</label>
                <select
                  value={dueDays}
                  onChange={(e) => setDueDays(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={7}>7 dagen</option>
                  <option value={14}>14 dagen</option>
                  <option value={30}>30 dagen</option>
                </select>
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{selectedParticipants.size}</span>{' '}
                {selectedParticipants.size === 1 ? 'factuur' : 'facturen'} selecteert |{' '}
                Subtotaal: {formatCurrency(totalAmount)} | Incl. BTW:{' '}
                <span className="font-semibold text-gray-900">{formatCurrency(totalWithTax)}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={selectedParticipants.size === 0 || generateMutation.isPending}
                  className={clsx(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    selectedParticipants.size === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  )}
                >
                  {generateMutation.isPending
                    ? 'Genereren...'
                    : `Genereer ${selectedParticipants.size} ${selectedParticipants.size === 1 ? 'Factuur' : 'Facturen'}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
