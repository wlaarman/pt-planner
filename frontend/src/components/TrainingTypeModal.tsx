import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, User, Users } from 'lucide-react';
import { trainingTypesApi } from '../lib/api';
import clsx from 'clsx';

interface TrainingType {
  id: string;
  name: string;
  description?: string;
  maxParticipants: number;
  defaultDuration: number;
  defaultRate?: number;
  icon: string;
  color: string;
}

interface TrainingTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editType?: TrainingType | null;
}

const COLORS = [
  '#4F46E5', // Indigo
  '#0EA5E9', // Sky
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

export default function TrainingTypeModal({ isOpen, onClose, editType }: TrainingTypeModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(1);
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [defaultRate, setDefaultRate] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  // Initialize form when editing
  useEffect(() => {
    if (editType) {
      setName(editType.name);
      setDescription(editType.description || '');
      setMaxParticipants(editType.maxParticipants);
      setDefaultDuration(editType.defaultDuration);
      setDefaultRate(editType.defaultRate?.toString() || '');
      setColor(editType.color);
    } else {
      resetForm();
    }
  }, [editType, isOpen]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setMaxParticipants(1);
    setDefaultDuration(60);
    setDefaultRate('');
    setColor(COLORS[0]);
    setError('');
  };

  const createMutation = useMutation({
    mutationFn: trainingTypesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-types'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Er is een fout opgetreden');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => trainingTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-types'] });
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

    if (!name) {
      setError('Vul alle verplichte velden in');
      return;
    }

    const data = {
      name,
      description: description || undefined,
      maxParticipants,
      defaultDuration,
      defaultRate: defaultRate ? parseFloat(defaultRate) : undefined,
      icon: maxParticipants === 1 ? 'user' : 'users',
      color,
    };

    if (editType) {
      updateMutation.mutate({ id: editType.id, data });
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
            {editType ? 'Trainingstype Bewerken' : 'Nieuw Trainingstype'}
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
              placeholder="Bijv. Personal Training, Duo Training"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschrijving
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optionele beschrijving..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
            />
          </div>

          {/* Max Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max. Deelnemers
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setMaxParticipants(num)}
                  className={clsx(
                    'flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all',
                    maxParticipants === num
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              {maxParticipants === 1 ? (
                <>
                  <User className="w-4 h-4" />
                  <span>Individuele training</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Groepstraining ({maxParticipants} personen)</span>
                </>
              )}
            </div>
          </div>

          {/* Default Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Standaard Duur
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => setDefaultDuration(duration)}
                  className={clsx(
                    'px-3 py-2 rounded-lg border-2 text-sm transition-all',
                    defaultDuration === duration
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  )}
                >
                  {duration} min
                </button>
              ))}
            </div>
          </div>

          {/* Default Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Standaard Tarief
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <input
                type="number"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="45.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Per sessie, kan per trainer worden aangepast</p>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kleur
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
            {editType ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
