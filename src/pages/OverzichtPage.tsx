import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoicesApi, trainersApi, participantsApi } from '../lib/api';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Euro,
  Search,
} from 'lucide-react';
import InvoiceGeneratorModal from '../components/InvoiceGeneratorModal';

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
    byTrainingType: Array<{
      trainingType: { id: string; name: string };
      totalHours: number;
      totalAmount: number;
    }>;
  };
}

export default function OverzichtPage() {
  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1));
  const [trainerId, setTrainerId] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());

  const periodStart = startOfMonth(selectedMonth);
  const periodEnd = endOfMonth(selectedMonth);
  const periodLabel = format(selectedMonth, 'MMMM yyyy', { locale: nl });

  // Fetch trainers and participants for filters
  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers'],
    queryFn: trainersApi.getAll,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['participants'],
    queryFn: () => participantsApi.getAll(),
  });

  // Fetch billable data only when "Toon Resultaten" is clicked
  const { data: billableData, isLoading, refetch } = useQuery<BillableData>({
    queryKey: ['billable', periodStart.toISOString(), periodEnd.toISOString(), trainerId, participantId],
    queryFn: () => invoicesApi.getBillable(
      periodStart.toISOString(),
      periodEnd.toISOString(),
      trainerId || undefined,
      participantId || undefined
    ),
    enabled: showResults,
  });

  const hasBillableData = !!(billableData?.participants && billableData?.summary);
  const billableSummary = hasBillableData ? billableData.summary : { totalParticipants: 0, totalHours: 0, totalAmount: 0 };
  const hasParticipants = billableSummary.totalParticipants > 0;

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

  const handleShowResults = () => {
    setShowResults(true);
    refetch();
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setSelectedMonth(direction === 'prev' ? subMonths(selectedMonth, 1) : addMonths(selectedMonth, 1));
    if (showResults) {
      // Will trigger refetch due to query key change
    }
  };

  const toggleParticipant = (id: string) => {
    setExpandedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="p-4 lg:p-6">
      <header className="mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Overzicht</h1>
        <p className="text-sm text-gray-500 mt-1">Bekijk en factureer trainingsuren</p>
      </header>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-5 mb-4 lg:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Month Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periode
            </label>
            <div className="flex items-center">
              <button
                onClick={() => handleMonthChange('prev')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-l-lg border border-r-0 border-gray-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 px-3 py-2 bg-white border-y border-gray-300 text-center">
                <span className="text-sm font-medium text-gray-900 capitalize">{periodLabel}</span>
              </div>
              <button
                onClick={() => handleMonthChange('next')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-r-lg border border-l-0 border-gray-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Trainer Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trainer
            </label>
            <select
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            >
              <option value="">Alle trainers</option>
              {trainers.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Participant Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deelnemer
            </label>
            <select
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            >
              <option value="">Alle deelnemers</option>
              {participants.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button
              onClick={handleShowResults}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
            >
              <Search className="w-4 h-4" />
              <span>Toon Resultaten</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {!showResults ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Selecteer een periode en klik op "Toon Resultaten"</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12 text-center text-gray-500">
          Laden...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-4 lg:mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 flex-shrink-0">
                <Calendar className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold text-gray-900">
                  {billableData?.participants?.reduce((sum, p) => sum + p.appointments.length, 0) || 0}
                </p>
                <p className="text-xs lg:text-sm text-gray-500 truncate">Sessies</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 flex-shrink-0">
                <Clock className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold text-gray-900">
                  {billableSummary.totalHours.toFixed(1)}
                </p>
                <p className="text-xs lg:text-sm text-gray-500 truncate">Uren</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 flex-shrink-0">
                <Euro className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold text-gray-900">
                  {formatCurrency(billableSummary.totalAmount)}
                </p>
                <p className="text-xs lg:text-sm text-gray-500 truncate">Totaal</p>
              </div>
            </div>
          </div>

          {/* Billable Participants */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Te factureren</h2>
                <p className="text-sm text-gray-500">
                  {billableSummary.totalParticipants} deelnemer{billableSummary.totalParticipants !== 1 ? 's' : ''} in {periodLabel}
                </p>
              </div>
              {hasParticipants && (
                <button
                  onClick={() => setShowGeneratorModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  <span>Facturen Genereren</span>
                </button>
              )}
            </div>

            {!hasParticipants ? (
              <div className="p-8 text-center text-gray-500">
                Geen factureerbare afspraken gevonden
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {billableData?.participants?.map((participant) => (
                  <div key={participant.id} className="bg-white">
                    {/* Participant Header - Clickable for expand/collapse */}
                    <button
                      onClick={() => toggleParticipant(participant.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 flex-shrink-0">
                          <span className="text-sm lg:text-base font-medium">
                            {participant.name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{participant.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {participant.byTrainingType?.map((t) => (
                              <span
                                key={t.trainingType.id}
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                              >
                                {t.trainingType.name}: {t.totalHours.toFixed(1)}u
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="font-semibold text-gray-900 text-sm lg:text-base">
                          {formatCurrency(participant.totalAmount)}
                        </span>
                        {expandedParticipants.has(participant.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {expandedParticipants.has(participant.id) && (
                      <div className="px-4 pb-4 bg-gray-50">
                        {participant.byTrainingType?.map((typeGroup) => (
                          <div key={typeGroup.trainingType.id} className="mb-3 last:mb-0">
                            <div className="flex items-center justify-between py-2 border-b border-gray-200">
                              <span className="text-sm font-medium text-gray-700">
                                {typeGroup.trainingType.name}
                              </span>
                              <span className="text-sm text-gray-600">
                                {typeGroup.totalHours.toFixed(1)}u - {formatCurrency(typeGroup.totalAmount)}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {typeGroup.appointments.map((apt) => (
                                <div
                                  key={apt.id}
                                  className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-gray-100"
                                >
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <span>{format(new Date(apt.date), 'd MMM', { locale: nl })}</span>
                                    <span className="text-gray-400">
                                      {apt.startTime} - {apt.endTime}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      ({apt.trainer.name})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-gray-600">
                                    <span className="text-xs text-gray-400">
                                      {(apt.duration / 60).toFixed(1)}u
                                    </span>
                                    <span className="font-medium">
                                      {formatCurrency(apt.amount)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Invoice Generator Modal */}
      <InvoiceGeneratorModal
        isOpen={showGeneratorModal}
        onClose={() => setShowGeneratorModal(false)}
        billableData={billableData || null}
        periodStart={periodStart.toISOString()}
        periodEnd={periodEnd.toISOString()}
        periodLabel={periodLabel}
      />
    </div>
  );
}
