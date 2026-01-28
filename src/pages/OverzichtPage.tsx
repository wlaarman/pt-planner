import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, eboekhoudenApi } from '../lib/api';
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
  const [showResults, setShowResults] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'billable' | 'invoices'>('billable');

  // e-Boekhouden modal state
  const [sendToEboekhoudenModal, setSendToEboekhoudenModal] = useState<Invoice | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return localStorage.getItem('eboekhouden-template-id') || '1493701';
  });
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>(() => {
    return localStorage.getItem('eboekhouden-ledger-id') || '';
  });

  // Batch selection for invoices
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [batchSendProgress, setBatchSendProgress] = useState<{ current: number; total: number } | null>(null);

  const periodStart = startOfMonth(selectedMonth);
  const periodEnd = endOfMonth(selectedMonth);
  const periodLabel = format(selectedMonth, 'MMMM yyyy', { locale: nl });

  // Fetch billable data only when "Toon Resultaten" is clicked
  const { data: billableData, isLoading, refetch } = useQuery<BillableData>({
    queryKey: ['billable', periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: () => invoicesApi.getBillable(
      periodStart.toISOString(),
      periodEnd.toISOString()
    ),
    enabled: showResults,
  });

  // Fetch existing invoices
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getAll(),
  });

  // Fetch e-Boekhouden relations when modal is open
  const { data: eboekhoudenRelationsData, isLoading: isLoadingRelations, error: relationsError } = useQuery({
    queryKey: ['eboekhouden-relations'],
    queryFn: () => eboekhoudenApi.getRelations(),
    enabled: !!sendToEboekhoudenModal,
  });

  // Fetch e-Boekhouden templates when modal is open
  const { data: eboekhoudenTemplatesData } = useQuery({
    queryKey: ['eboekhouden-templates'],
    queryFn: () => eboekhoudenApi.getTemplates(),
    enabled: !!sendToEboekhoudenModal,
  });

  // Fetch e-Boekhouden ledgers when modal is open
  const { data: eboekhoudenLedgersData, isLoading: isLoadingLedgers } = useQuery({
    queryKey: ['eboekhouden-ledgers'],
    queryFn: () => eboekhoudenApi.getLedgers(),
    enabled: !!sendToEboekhoudenModal,
  });

  // Handle ledgers response (may be { ledgers: [], debug: {} } or just [])
  const eboekhoudenLedgers = Array.isArray(eboekhoudenLedgersData)
    ? eboekhoudenLedgersData
    : (eboekhoudenLedgersData?.ledgers || []);

  // Log ledgers debug info
  if (eboekhoudenLedgersData?.debug) {
    console.log('e-Boekhouden ledgers debug:', eboekhoudenLedgersData.debug);
  }

  // Ensure relations is always an array (defensive against API response format issues)
  // The API now returns { relations: [], debug: {} }
  const eboekhoudenRelations = Array.isArray(eboekhoudenRelationsData)
    ? eboekhoudenRelationsData
    : (eboekhoudenRelationsData?.relations || []);

  // Log debug info if available
  if (eboekhoudenRelationsData?.debug) {
    console.log('e-Boekhouden relations debug:', eboekhoudenRelationsData.debug);
  }

  // Log templates info
  if (eboekhoudenTemplatesData !== undefined) {
    console.log('e-Boekhouden templates:', eboekhoudenTemplatesData);
  }

  // e-Boekhouden connection status
  const { data: eboekhoudenStatus } = useQuery({
    queryKey: ['eboekhouden-status'],
    queryFn: () => eboekhoudenApi.getStatus(),
  });

  // Send to e-Boekhouden mutation
  const [sendError, setSendError] = useState<string | null>(null);
  const sendToEboekhoudenMutation = useMutation({
    mutationFn: (params: { invoiceId: string; relationId: number; templateId: number; ledgerId: number }) =>
      eboekhoudenApi.sendInvoice(params.invoiceId, params.relationId, params.templateId, params.ledgerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSendToEboekhoudenModal(null);
      setSelectedRelationId('');
      setSelectedTemplateId('1493701');
      setSelectedLedgerId('');
      setSendError(null);
    },
    onError: (error: any) => {
      console.error('e-Boekhouden send error:', error);
      console.error('e-Boekhouden error response:', error?.response?.data);
      const errorData = error?.response?.data;
      const errorMsg = typeof errorData === 'string'
        ? errorData
        : errorData?.error || errorData?.message || JSON.stringify(errorData) || error?.message || 'Onbekende fout';
      setSendError(errorMsg);
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

  const handleSendToEboekhouden = async () => {
    if (!sendToEboekhoudenModal || !selectedRelationId || !selectedTemplateId || !selectedLedgerId) return;
    // Save preferences to localStorage
    localStorage.setItem('eboekhouden-template-id', selectedTemplateId);
    localStorage.setItem('eboekhouden-ledger-id', selectedLedgerId);

    // Batch send mode
    if (sendToEboekhoudenModal.id === 'batch') {
      const invoiceIds = Array.from(selectedInvoices);
      setBatchSendProgress({ current: 0, total: invoiceIds.length });

      for (let i = 0; i < invoiceIds.length; i++) {
        try {
          await eboekhoudenApi.sendInvoice(
            invoiceIds[i],
            parseInt(selectedRelationId),
            parseInt(selectedTemplateId),
            parseInt(selectedLedgerId)
          );
          setBatchSendProgress({ current: i + 1, total: invoiceIds.length });
        } catch (error: any) {
          const invoice = invoices.find((inv) => inv.id === invoiceIds[i]);
          setSendError(`Fout bij factuur ${invoice?.invoiceNumber || invoiceIds[i]}: ${error?.response?.data?.error || error?.message || 'Onbekende fout'}`);
          setBatchSendProgress(null);
          return;
        }
      }

      // All sent successfully
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSendToEboekhoudenModal(null);
      setSelectedRelationId('');
      setSelectedInvoices(new Set());
      setBatchSendProgress(null);
      setSendError(null);
    } else {
      // Single invoice mode
      sendToEboekhoudenMutation.mutate({
        invoiceId: sendToEboekhoudenModal.id,
        relationId: parseInt(selectedRelationId),
        templateId: parseInt(selectedTemplateId),
        ledgerId: parseInt(selectedLedgerId),
      });
    }
  };

  // Toggle invoice selection for batch send
  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  // Get sendable invoices (not yet in e-Boekhouden)
  const sendableInvoices = invoices.filter(
    (inv) => !inv.notes?.includes('e-Boekhouden') && eboekhoudenStatus?.connected
  );

  // Toggle all sendable invoices
  const toggleAllInvoices = () => {
    if (selectedInvoices.size === sendableInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(sendableInvoices.map((inv) => inv.id)));
    }
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
        <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
          {/* Period Selection */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periode
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center flex-1">
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
            {/* Quick period buttons */}
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => setSelectedMonth(subMonths(new Date(), 1))}
                className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Vorige maand
              </button>
              <button
                onClick={() => setSelectedMonth(new Date())}
                className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Deze maand
              </button>
            </div>
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button
              onClick={handleShowResults}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
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
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Aangemaakte facturen</h2>
              <p className="text-sm text-gray-500">Verstuur naar e-Boekhouden voor verdere verwerking</p>
            </div>
            {sendableInvoices.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAllInvoices}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {selectedInvoices.size === sendableInvoices.length ? 'Deselecteer alle' : 'Selecteer alle'}
                </button>
                {selectedInvoices.size > 0 && (
                  <button
                    onClick={() => {
                      setSendError(null);
                      // Open modal for batch send - we'll use a special marker
                      setSendToEboekhoudenModal({ id: 'batch' } as Invoice);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span>Verstuur {selectedInvoices.size} facturen</span>
                  </button>
                )}
              </div>
            )}
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
                        {!isSentToEboekhouden && eboekhoudenStatus?.connected && (
                          <input
                            type="checkbox"
                            checked={selectedInvoices.has(invoice.id)}
                            onChange={() => toggleInvoiceSelection(invoice.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500 flex-shrink-0"
                          />
                        )}
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Verstuur naar e-Boekhouden</h3>
              <p className="text-sm text-gray-500 mt-1">
                {sendToEboekhoudenModal.id === 'batch'
                  ? `${selectedInvoices.size} facturen geselecteerd`
                  : `Factuur ${sendToEboekhoudenModal.invoiceNumber} voor ${sendToEboekhoudenModal.participant?.name}`
                }
              </p>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecteer relatie in e-Boekhouden
                {sendToEboekhoudenModal.id === 'batch' && (
                  <span className="font-normal text-gray-500 ml-1">(voor alle facturen)</span>
                )}
              </label>
              {isLoadingRelations ? (
                <div className="text-sm text-gray-500">Relaties laden...</div>
              ) : relationsError ? (
                <div className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Fout bij laden relaties: {(relationsError as Error)?.message || 'Onbekende fout'}
                </div>
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
                      {rel.company || rel.bedrijf || rel.Bedrijf || rel.name || rel.naam || rel.Naam || rel.code || rel.Code || rel.relatiecode || `Relatie ${rel.id}`}
                    </option>
                  ))}
                </select>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Factuursjabloon ID
                </label>
                <input
                  type="number"
                  min="1"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  placeholder="Bijv. 1493701"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Vind dit in e-Boekhouden → Beheer → Factuursjablonen → URL
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grootboekrekening (omzet)
                </label>
                {isLoadingLedgers ? (
                  <div className="text-sm text-gray-500">Laden...</div>
                ) : eboekhoudenLedgers.length === 0 ? (
                  <div className="text-sm text-amber-600">Geen grootboekrekeningen gevonden</div>
                ) : (
                  <select
                    value={selectedLedgerId}
                    onChange={(e) => setSelectedLedgerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  >
                    <option value="">Selecteer grootboekrekening...</option>
                    {eboekhoudenLedgers.map((ledger: any) => (
                      <option key={ledger.id} value={ledger.id}>
                        {ledger.code} - {ledger.description || ledger.name || ledger.omschrijving || `Rekening ${ledger.id}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {sendToEboekhoudenModal.id === 'batch' ? (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-gray-700 mb-2">Geselecteerde facturen:</p>
                  {invoices
                    .filter((inv) => selectedInvoices.has(inv.id))
                    .map((inv) => (
                      <div key={inv.id} className="flex justify-between text-sm text-gray-600 py-1">
                        <span>{inv.invoiceNumber} - {inv.participant?.name}</span>
                        <span>{formatCurrency(Number(inv.total) || 0)}</span>
                      </div>
                    ))}
                  <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-medium text-gray-900">
                    <span>Totaal</span>
                    <span>
                      {formatCurrency(
                        invoices
                          .filter((inv) => selectedInvoices.has(inv.id))
                          .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Bedrag:</strong> {formatCurrency(Number(sendToEboekhoudenModal.total) || 0)}
                  </p>
                </div>
              )}

              {(sendError || sendToEboekhoudenMutation.isError) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <strong>Fout:</strong> {sendError || 'Er ging iets mis bij het versturen'}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex-shrink-0">
              {batchSendProgress && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Versturen...</span>
                    <span>{batchSendProgress.current} / {batchSendProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(batchSendProgress.current / batchSendProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSendToEboekhoudenModal(null);
                    setSelectedRelationId('');
                    setBatchSendProgress(null);
                  }}
                  disabled={!!batchSendProgress}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSendToEboekhouden}
                  disabled={!selectedRelationId || !selectedTemplateId || !selectedLedgerId || sendToEboekhoudenMutation.isPending || !!batchSendProgress}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ExternalLink className="w-4 h-4" />
                  {batchSendProgress
                    ? `Versturen ${batchSendProgress.current}/${batchSendProgress.total}...`
                    : sendToEboekhoudenMutation.isPending
                      ? 'Versturen...'
                      : sendToEboekhoudenModal.id === 'batch'
                        ? `Verstuur ${selectedInvoices.size} facturen`
                        : 'Verstuur naar e-Boekhouden'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
