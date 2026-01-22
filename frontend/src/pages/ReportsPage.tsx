import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, trainersApi, participantsApi } from '../lib/api';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Download, FileText, Calendar, Clock, Euro } from 'lucide-react';

export default function ReportsPage() {
  const [participantId, setParticipantId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [period, setPeriod] = useState('3months');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case 'month':
        return {
          startDate: startOfMonth(now).toISOString(),
          endDate: endOfMonth(now).toISOString(),
        };
      case '3months':
        return {
          startDate: startOfMonth(subMonths(now, 2)).toISOString(),
          endDate: endOfMonth(now).toISOString(),
        };
      case 'year':
        return {
          startDate: new Date(now.getFullYear(), 0, 1).toISOString(),
          endDate: endOfMonth(now).toISOString(),
        };
      default:
        return {};
    }
  };

  const { data: participants = [] } = useQuery({
    queryKey: ['participants'],
    queryFn: () => participantsApi.getAll(),
  });

  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers'],
    queryFn: trainersApi.getAll,
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', participantId, trainerId, period],
    queryFn: () =>
      reportsApi.get({
        participantId: participantId || undefined,
        trainerId: trainerId || undefined,
        ...getDateRange(),
      }),
    enabled: !!participantId || !!trainerId,
  });

  const toggleItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (report?.items) {
      if (selectedItems.length === report.items.length) {
        setSelectedItems([]);
      } else {
        setSelectedItems(report.items.map((item: any) => item.id));
      }
    }
  };

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Rapportage</h1>
      </header>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deelnemer
            </label>
            <select
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Alle deelnemers</option>
              {participants.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periode
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="month">Deze maand</option>
              <option value="3months">Afgelopen 3 maanden</option>
              <option value="year">Dit jaar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trainer
            </label>
            <select
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Alle trainers</option>
              {trainers.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
              Genereer Rapport
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {!participantId && !trainerId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Selecteer een deelnemer of trainer om een rapport te genereren
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Rapport laden...
        </div>
      ) : report ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Report Header */}
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Rapport:{' '}
                {participantId
                  ? participants.find((p: any) => p.id === participantId)?.name
                  : 'Alle deelnemers'}
              </h2>
              <p className="text-sm text-gray-500">
                Periode:{' '}
                {period === 'month'
                  ? 'Deze maand'
                  : period === '3months'
                  ? 'Afgelopen 3 maanden'
                  : 'Dit jaar'}
              </p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                <FileText className="w-4 h-4" />
                Maak Factuur
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-6 p-5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {report.summary.totalSessions}
                </p>
                <p className="text-sm text-gray-500">Totaal sessies</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {report.summary.totalHours}
                </p>
                <p className="text-sm text-gray-500">Totaal uren</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                <Euro className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {report.summary.totalCost.toLocaleString('nl-NL', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </p>
                <p className="text-sm text-gray-500">Totaal kosten</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === report.items?.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Datum
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Tijd
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Trainer
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Duur
                  </th>
                  <th className="pb-3 text-right text-xs font-semibold text-gray-500 uppercase">
                    Bedrag
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.items?.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="py-3 text-gray-900">
                      {format(new Date(item.date), 'd MMM yyyy', { locale: nl })}
                    </td>
                    <td className="py-3 text-gray-600">
                      {format(new Date(item.startTime), 'HH:mm')} -{' '}
                      {format(new Date(item.endTime), 'HH:mm')}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                        {item.trainingType.name}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">{item.trainer.name}</td>
                    <td className="py-3 text-gray-600">
                      {Math.floor(item.durationMinutes / 60)}:
                      {(item.durationMinutes % 60).toString().padStart(2, '0')}
                    </td>
                    <td className="py-3 text-right text-gray-900">
                      {item.cost.toLocaleString('nl-NL', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
