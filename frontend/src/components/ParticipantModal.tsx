import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { participantsApi, trainingTypesApi } from '../lib/api';

interface Participant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  preferredType?: string;
}

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  editParticipant?: Participant | null;
}

export default function ParticipantModal({ isOpen, onClose, editParticipant }: ParticipantModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [preferredType, setPreferredType] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const { data: trainingTypes = [] } = useQuery({
    queryKey: ['training-types'],
    queryFn: trainingTypesApi.getAll,
    enabled: isOpen,
  });

  // Initialize form when editing
  useEffect(() => {
    if (editParticipant) {
      setName(editParticipant.name);
      setEmail(editParticipant.email);
      setPhone(editParticipant.phone || '');
      setNotes(editParticipant.notes || '');
      setPreferredType(editParticipant.preferredType || '');
    } else {
      resetForm();
    }
  }, [editParticipant, isOpen]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setPreferredType('');
    setError('');
  };

  const createMutation = useMutation({
    mutationFn: participantsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Er is een fout opgetreden');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => participantsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Er is een fout opgetreden');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email) {
      setError('Vul alle verplichte velden in');
      return;
    }

    const data = {
      name,
      email,
      phone: phone || undefined,
      notes: notes || undefined,
      preferredType: preferredType || undefined,
    };

    if (editParticipant) {
      updateMutation.mutate({ id: editParticipant.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full lg:max-w-md lg:rounded-xl rounded-t-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold">
            {editParticipant ? 'Deelnemer Bewerken' : 'Nieuwe Deelnemer'}
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
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Naam *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Volledige naam"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@voorbeeld.nl"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefoon
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06-12345678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Preferred Training Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voorkeur Trainingstype
            </label>
            <select
              value={preferredType}
              onChange={(e) => setPreferredType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            >
              <option value="">Geen voorkeur</option>
              {trainingTypes.map((type: any) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notities
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Bijzonderheden, blessures, doelen..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
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
            disabled={isPending}
            className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editParticipant ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
