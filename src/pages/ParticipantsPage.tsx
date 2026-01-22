import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { participantsApi } from '../lib/api';
import { Plus, Search, Pencil, Trash2, BarChart3, Mail, Phone, Calendar } from 'lucide-react';
import ParticipantModal from '../components/ParticipantModal';
import clsx from 'clsx';

interface Participant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  preferredType?: string;
  _count: { appointments: number };
}

export default function ParticipantsPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const queryClient = useQueryClient();

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['participants', search],
    queryFn: () => participantsApi.getAll(search || undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: participantsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (participant: Participant) => {
    setEditingParticipant(participant);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingParticipant(null);
  };

  const getTypeBadgeClass = (type?: string) => {
    switch (type) {
      case '1-op-1':
        return 'bg-primary-100 text-primary-700';
      case '1-op-2':
        return 'bg-green-100 text-green-700';
      case 'Groep':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Deelnemers</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoeken..."
              className="w-full sm:w-48 lg:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            />
          </div>
          {/* Add button */}
          <button
            onClick={() => {
              setEditingParticipant(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nieuwe Deelnemer</span>
            <span className="sm:hidden">Nieuw</span>
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Laden...</div>
      ) : participants.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">
            {search ? 'Geen deelnemers gevonden' : 'Nog geen deelnemers.'}
          </p>
          {!search && <p className="text-sm">Voeg je eerste deelnemer toe!</p>}
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {participants.map((participant: Participant) => (
              <div
                key={participant.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-lg font-medium flex-shrink-0">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {participant.name}
                    </h3>
                    {participant.preferredType && (
                      <span
                        className={clsx(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1',
                          getTypeBadgeClass(participant.preferredType)
                        )}
                      >
                        {participant.preferredType}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                  <a
                    href={`mailto:${participant.email}`}
                    className="flex items-center gap-2 hover:text-primary-600"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{participant.email}</span>
                  </a>
                  {participant.phone && (
                    <a
                      href={`tel:${participant.phone}`}
                      className="flex items-center gap-2 hover:text-primary-600"
                    >
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{participant.phone}</span>
                    </a>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>{participant._count.appointments} afspraken</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(participant)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Bewerken
                  </button>
                  <button
                    onClick={() => handleDelete(participant.id, participant.name)}
                    className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Naam
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Telefoon
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Voorkeur
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Afspraken
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {participants.map((participant: Participant) => (
                  <tr key={participant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium">
                          {participant.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">
                          {participant.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {participant.email}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {participant.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {participant.preferredType && (
                        <span
                          className={clsx(
                            'inline-flex px-2.5 py-1 rounded-full text-xs font-medium',
                            getTypeBadgeClass(participant.preferredType)
                          )}
                        >
                          {participant.preferredType}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {participant._count.appointments}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Rapportage"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(participant)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Bewerken"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(participant.id, participant.name)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Verwijderen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ParticipantModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editParticipant={editingParticipant}
      />
    </div>
  );
}
