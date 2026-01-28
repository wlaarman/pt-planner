import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainersApi } from '../lib/api';
import { Plus, Pencil, Trash2, Calendar, Euro, Phone, Mail } from 'lucide-react';
import TrainerModal from '../components/TrainerModal';

interface Trainer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  color: string;
  hourlyRate?: number;
  _count: { appointments: number };
}

export default function TrainersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const queryClient = useQueryClient();

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ['trainers'],
    queryFn: trainersApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: trainersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
  });

  const handleDelete = (trainer: Trainer) => {
    const appointmentCount = trainer._count.appointments;
    let message = `Weet je zeker dat je ${trainer.name} wilt verwijderen?`;

    if (appointmentCount > 0) {
      message = `${trainer.name} heeft ${appointmentCount} afspra${appointmentCount === 1 ? 'ak' : 'ken'}.\n\nAls je doorgaat worden deze afspraken ook verwijderd.\n\nWeet je zeker dat je wilt doorgaan?`;
    }

    if (confirm(message)) {
      deleteMutation.mutate(trainer.id);
    }
  };

  const handleEdit = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTrainer(null);
  };

  return (
    <div className="p-4 lg:p-6">
      <header className="flex items-center justify-between mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Trainers</h1>
        <button
          onClick={() => {
            setEditingTrainer(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nieuwe Trainer</span>
          <span className="sm:hidden">Nieuw</span>
        </button>
      </header>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Laden...</div>
      ) : trainers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Nog geen trainers.</p>
          <p className="text-sm">Voeg je eerste trainer toe!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {trainers.map((trainer: Trainer) => (
            <div
              key={trainer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Card Header with color accent */}
              <div
                className="h-2"
                style={{ backgroundColor: trainer.color }}
              />

              <div className="p-4 lg:p-5">
                <div className="flex items-start gap-3 lg:gap-4">
                  <div
                    className="w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-white text-lg lg:text-xl font-medium flex-shrink-0"
                    style={{ backgroundColor: trainer.color }}
                  >
                    {trainer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {trainer.name}
                    </h3>
                    <div className="space-y-1.5 mt-2 text-sm text-gray-600">
                      <a
                        href={`mailto:${trainer.email}`}
                        className="flex items-center gap-2 hover:text-primary-600 transition-colors"
                      >
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{trainer.email}</span>
                      </a>
                      {trainer.phone && (
                        <a
                          href={`tel:${trainer.phone}`}
                          className="flex items-center gap-2 hover:text-primary-600 transition-colors"
                        >
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span>{trainer.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{trainer._count.appointments} afspraken</span>
                  </div>
                  {trainer.hourlyRate && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Euro className="w-4 h-4" />
                      <span>{Number(trainer.hourlyRate).toFixed(2)}/uur</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(trainer)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Bewerken
                  </button>
                  <button
                    onClick={() => handleDelete(trainer)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TrainerModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editTrainer={editingTrainer}
      />
    </div>
  );
}
