import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../lib/api';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Eye,
  Download,
  Check,
  Mail,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Calculator,
} from 'lucide-react';
import clsx from 'clsx';
import InvoiceGeneratorModal from '../components/InvoiceGeneratorModal';

interface InvoiceStats {
  open: { count: number; total: number };
  paid: { count: number; total: number };
  overdue: { count: number; total: number };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  total: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  participant: { id: string; name: string; email: string };
}

const statusConfig = {
  DRAFT: { label: 'Concept', className: 'bg-gray-100 text-gray-700' },
  SENT: { label: 'Open', className: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Betaald', className: 'bg-green-100 text-green-700' },
  OVERDUE: { label: 'Te laat', className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Geannuleerd', className: 'bg-gray-100 text-gray-500' },
};

interface BillableData {
  participants: Array<{
    id: string;
    name: string;
    email: string;
    appointments: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      duration: number;
      trainer: { id: string; name: string; hourlyRate: number | null };
      trainingType: { id: string; name: string; defaultRate: number | null };
      rate: number;
      amount: number;
    }>;
    totalMinutes: number;
    totalHours: number;
    totalAmount: number;
  }>;
  summary: {
    totalParticipants: number;
    totalHours: number;
    totalAmount: number;
  };
}

export default function InvoicesPage() {
  const queryClient = useQueryClient();

  // Period selector state - default to last month
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1));
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  const periodStart = startOfMonth(selectedMonth);
  const periodEnd = endOfMonth(selectedMonth);
  const periodLabel = format(selectedMonth, 'MMMM yyyy', { locale: nl });

  const { data: stats, error: statsError } = useQuery<InvoiceStats>({
    queryKey: ['invoice-stats'],
    queryFn: invoicesApi.getStats,
  });

  const { data: invoices = [], isLoading, error: invoicesError } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getAll(),
  });

  const { data: billableData, isLoading: isBillableLoading, error: billableError } = useQuery<BillableData>({
    queryKey: ['billable', periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: () => invoicesApi.getBillable(periodStart.toISOString(), periodEnd.toISOString()),
  });

  // Log errors for debugging
  if (statsError) console.error('Stats error:', statsError);
  if (invoicesError) console.error('Invoices error:', invoicesError);
  if (billableError) console.error('Billable error:', billableError);

  // Safe accessors for billable data to prevent crashes
  const hasBillableData = !!(billableData?.participants && billableData?.summary);
  const billableSummary = hasBillableData ? billableData.summary : { totalParticipants: 0, totalHours: 0, totalAmount: 0 };
  const hasParticipants = billableSummary.totalParticipants > 0;

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      invoicesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Facturatie</h1>
      </header>

      {/* Period Selector & Billable Summary */}
      <div className="bg-gradient-to-r from-primary-50 to-white rounded-xl border border-primary-100 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 bg-white rounded-lg border border-gray-200 min-w-[180px] text-center">
              <span className="font-medium text-gray-900 capitalize">{periodLabel}</span>
            </div>
            <button
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Billable Summary */}
          {isBillableLoading ? (
            <div className="text-sm text-gray-500">Laden...</div>
          ) : billableError ? (
            <div className="text-sm text-red-500">
              Fout bij laden factureerbare data
            </div>
          ) : hasParticipants ? (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary-500" />
                <span className="text-gray-600">
                  {billableSummary.totalHours.toFixed(1)} uur
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-primary-500" />
                <span className="text-gray-600">
                  {billableSummary.totalParticipants} deelnemers
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calculator className="w-4 h-4 text-primary-500" />
                <span className="font-semibold text-gray-900">
                  {formatCurrency(billableSummary.totalAmount)}
                </span>
              </div>
              <button
                onClick={() => setShowGeneratorModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Facturen Genereren
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Geen factureerbare afspraken in deze periode
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">
              {stats?.open?.count ?? 0}
            </p>
            <p className="text-sm text-gray-500">Open facturen</p>
          </div>
          <p className="text-lg font-semibold text-gray-600">
            {formatCurrency(stats?.open?.total ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">
              {stats?.paid?.count ?? 0}
            </p>
            <p className="text-sm text-gray-500">Betaalde facturen</p>
          </div>
          <p className="text-lg font-semibold text-gray-600">
            {formatCurrency(stats?.paid?.total ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">
              {stats?.overdue?.count ?? 0}
            </p>
            <p className="text-sm text-gray-500">Te laat</p>
          </div>
          <p className="text-lg font-semibold text-gray-600">
            {formatCurrency(stats?.overdue?.total ?? 0)}
          </p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Factuurnr.
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Deelnemer
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Vervaldatum
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Bedrag
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Acties
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Laden...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Nog geen facturen
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const statusCfg = statusConfig[invoice.status] || statusConfig.DRAFT;
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {invoice.participant?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {invoice.issueDate
                        ? format(new Date(invoice.issueDate), 'd MMM yyyy', { locale: nl })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {invoice.dueDate
                        ? format(new Date(invoice.dueDate), 'd MMM yyyy', { locale: nl })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {formatCurrency(Number(invoice.total) || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'inline-flex px-2.5 py-1 rounded-full text-xs font-medium',
                          statusCfg.className
                        )}
                      >
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Bekijken"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {invoice.status === 'SENT' && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: invoice.id,
                                status: 'PAID',
                              })
                            }
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Markeer betaald"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.status === 'OVERDUE' && (
                          <button
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Stuur herinnering"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Accounting Link - placeholder for future e-boekhouden integration */}
      {/*
      <div className="mt-6 bg-gray-50 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <LinkIcon className="w-4 h-4 text-primary-500" />
          <span className="text-gray-600">
            Gekoppeld met: <strong>e-Boekhouden</strong>
          </span>
          <span className="text-gray-400">
            Laatst gesynchroniseerd: 5 min geleden
          </span>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors">
          <RefreshCw className="w-4 h-4" />
          Synchroniseer Nu
        </button>
      </div>
      */}

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
