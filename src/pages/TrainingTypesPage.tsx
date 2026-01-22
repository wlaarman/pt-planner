import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingTypesApi } from '../lib/api';
import { Plus, Pencil, Trash2, User, Users, Clock, Euro } from 'lucide-react';
import TrainingTypeModal from '../components/TrainingTypeModal';

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

const typeIcons: Record<string, React.ReactNode> = {
  user: <User className="w-6 h-6" />,
  'user-friends': <Users className="w-6 h-6" />,
  users: <Users className="w-6 h-6" />,
};

export default function TrainingTypesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<TrainingType | null>(null);
  const queryClient = useQueryClient();

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['training-types'],
    queryFn: trainingTypesApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: trainingTypesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-types'] });
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (type: TrainingType) => {
    setEditingType(type);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
  };

  return (
    <div className="p-4 lg:p-6">
      <header className="flex items-center justify-between mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Trainingstypes</h1>
        <button
          onClick={() => {
            setEditingType(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nieuw Type</span>
          <span className="sm:hidden">Nieuw</span>
        </button>
      </header>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Laden...</div>
      ) : types.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Nog geen trainingstypes.</p>
          <p className="text-sm">Voeg je eerste type toe!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {types.map((type: TrainingType) => (
            <div
              key={type.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Card Header with color accent */}
              <div
                className="h-2"
                style={{ backgroundColor: type.color }}
              />

              <div className="p-4 lg:p-5">
                <div className="flex items-start gap-3 lg:gap-4">
                  <div
                    className="w-12 h-12 lg:w-14 lg:h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `${type.color}20`,
                      color: type.color,
                    }}
                  >
                    {typeIcons[type.icon] || <User className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {type.name}
                    </h3>
                    {type.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {type.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400" />
                    Max {type.maxParticipants}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {type.defaultDuration} min
                  </span>
                  {type.defaultRate && (
                    <span className="flex items-center gap-1.5">
                      <Euro className="w-4 h-4 text-gray-400" />
                      {Number(type.defaultRate).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(type)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Bewerken
                  </button>
                  <button
                    onClick={() => handleDelete(type.id, type.name)}
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

      <TrainingTypeModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editType={editingType}
      />
    </div>
  );
}
