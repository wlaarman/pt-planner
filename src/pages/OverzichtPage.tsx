import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, trainersApi, participantsApi, eboekhoudenApi } from '../lib/api';
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
  Send,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import InvoiceGeneratorModal from '../components/InvoiceGeneratorModal';

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  total: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  notes?: string;
  participant: { id: string; name: string; email: string };
}

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

const statusConfig = {
  DRAFT: { label: 'Concept', className: 'bg-gray-100 text-gray-700' },
  SENT: { label: 'Verzonden', className: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Betaald', className: 'bg-green-100 text-green-700' },
  OVERDUE: { label: 'Te laat', className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Geannuleerd', className: 'bg-gray-100 text-gray-500' },
};

export default function OverzichtPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1));
  const [trainerId, setTrainerId] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'billable' | 'invoices'>('billable');

  // e-Boekhouden modal state
  const [sendToEboekhoudenModal, setSendToEboekhoudenModal] = useState<Invoice | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string>('');

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

  // Fetch existing invoices
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getAll(),
  });

  // Fetch e-Boekhouden relations when modal is open
  const { data: eboekhoudenRelations = [], isLoading: isLoadingRelations } = useQuery({
    queryKey: ['eboekhouden-relations'],
    queryFn: () => eboekhoudenApi.getRelations(),
    enabled: !!sendToEboekhoudenModal,
  });

  // e-Boekhouden connection status
  const { data: eboekhoudenStatus } = useQuery({
    queryKey: ['eboekhouden-status'],
    queryFn: () => eboekhoudenApi.getStatus(),
  });

  // Send to e-Boekhouden mutation
  const [sendError, setSendError] = useState<string | null>(null);
  const sendToEboekhoudenMutation = useMutation({
    mutationFn: (params: { invoiceId: string; relationId: number }) =>
      eboekhoudenApi.sendInvoice(params.invoiceId, params.relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSendToEboekhoudenModal(null);
      setSelectedRelationId('');
      setSendError(null);
    },
    onError: (error: any) => {
      console.error('e-Boekhouden send error:', error);
      setSendError(error?.response?.data?.error || error?.message || 'Onbekende fout');
    },
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

  const handleSendToEboekhouden = () => {
    if (!sendToEboekhoudenModal || !selectedRelationId) return;
    sendToEboekhoudenMutation.mutate({
      invoiceId: sendToEboekhoudenModal.id,
      relationId: parseInt(selectedRelationId),
    });
  };

  return (
    <div className="p-4 lg:p-6">
      <header className="mb-4 lg:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Overzicht</h1>
            <p className="text-sm text-gray-500 mt-1">Bekijk en factureer trainingsuren</p>
          </div>
          {eboekhoudenStatus?.connected ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>e-Boekhouden verbonden</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span>e-Boekhouden niet verbonden</span>
            </div>
          )}
        </div>
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('billable')}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'billable'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Te factureren
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'invoices'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Facturen ({invoices.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'billable' ? (
        <>
          {/* Billable Results */}
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
        </>
      ) : (
        /* Invoices Tab */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Aangemaakte facturen</h2>
            <p className="text-sm text-gray-500">Verstuur naar e-Boekhouden voor verdere verwerking</p>
          </div>

          {isLoadingInvoices ? (
            <div className="p-8 text-center text-gray-500">Laden...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nog geen facturen aangemaakt</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {invoices.map((invoice) => {
                const statusCfg = statusConfig[invoice.status] || statusConfig.DRAFT;
                const isSentToEboekhouden = invoice.notes?.includes('e-Boekhouden');

                return (
                  <div key={invoice.id} className="p-4 hover:bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                            <span className={clsx(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                              statusCfg.className
                            )}>
                              {statusCfg.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">{invoice.participant?.name}</p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(invoice.issueDate), 'd MMM yyyy', { locale: nl })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(Number(invoice.total) || 0)}
                          </p>
                          {isSentToEboekhouden && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              In e-Boekhouden
                            </p>
                          )}
                        </div>

                        {!isSentToEboekhouden && eboekhoudenStatus?.connected && (
                          <button
                            onClick={() => {
                              setSendError(null);
                              setSendToEboekhoudenModal(invoice);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Send className="w-4 h-4" />
                            <span className="hidden sm:inline">Versturen</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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

      {/* Send to e-Boekhouden Modal */}
      {sendToEboekhoudenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Verstuur naar e-Boekhouden</h3>
              <p className="text-sm text-gray-500 mt-1">
                Factuur {sendToEboekhoudenModal.invoiceNumber} voor {sendToEboekhoudenModal.participant?.name}
              </p>
            </div>

            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecteer relatie in e-Boekhouden
              </label>
              {isLoadingRelations ? (
                <div className="text-sm text-gray-500">Relaties laden...</div>
              ) : eboekhoudenRelations.length === 0 ? (
                <div className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Geen relaties gevonden in e-Boekhouden
                </div>
              ) : (
                <select
                  value={selectedRelationId}
                  onChange={(e) => setSelectedRelationId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                >
                  <option value="">Selecteer een relatie...</option>
                  {eboekhoudenRelations.map((rel: any) => (
                    <option key={rel.id} value={rel.id}>
                      {rel.company || rel.name || `Relatie ${rel.id}`}
                    </option>
                  ))}
                </select>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Bedrag:</strong> {formatCurrency(Number(sendToEboekhoudenModal.total) || 0)}
                </p>
              </div>

              {(sendError || sendToEboekhoudenMutation.isError) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <strong>Fout:</strong> {sendError || 'Er ging iets mis bij het versturen'}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setSendToEboekhoudenModal(null);
                  setSelectedRelationId('');
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleSendToEboekhouden}
                disabled={!selectedRelationId || sendToEboekhoudenMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExternalLink className="w-4 h-4" />
                {sendToEboekhoudenMutation.isPending ? 'Versturen...' : 'Verstuur naar e-Boekhouden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
