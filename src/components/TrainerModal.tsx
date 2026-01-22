import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { trainersApi } from '../lib/api';

interface Trainer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  color: string;
  hourlyRate?: number;
}

interface TrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTrainer?: Trainer | null;
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

export default function TrainerModal({ isOpen, onClose, editTrainer }: TrainerModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  // Initialize form when editing
  useEffect(() => {
    if (editTrainer) {
      setName(editTrainer.name);
      setEmail(editTrainer.email);
      setPhone(editTrainer.phone || '');
      setColor(editTrainer.color);
      setHourlyRate(editTrainer.hourlyRate?.toString() || '');
      setPassword('');
    } else {
      resetForm();
    }
  }, [editTrainer, isOpen]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setColor(COLORS[0]);
    setHourlyRate('');
    setPassword('');
    setError('');
  };

  const createMutation = useMutation({
    mutationFn: trainersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Er is een fout opgetreden');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => trainersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
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

    if (!editTrainer && !password) {
      setError('Wachtwoord is verplicht voor nieuwe trainers');
      return;
    }

    const data: any = {
      name,
      email,
      phone: phone || undefined,
      color,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
    };

    if (password) {
      data.password = password;
    }

    if (editTrainer) {
      updateMutation.mutate({ id: editTrainer.id, data });
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
            {editTrainer ? 'Trainer Bewerken' : 'Nieuwe Trainer'}
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

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wachtwoord {!editTrainer && '*'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editTrainer ? 'Laat leeg om niet te wijzigen' : 'Kies een wachtwoord'}
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

          {/* Hourly Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uurtarief
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="45.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agenda Kleur
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
            {editTrainer ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
