import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, CheckCircle, Link as LinkIcon, Plus, Search, AlertCircle } from 'lucide-react';
import { eboekhoudenApi, participantsApi } from '../lib/api';
import clsx from 'clsx';

interface Participant {
  id: string;
  name: string;
  email: string;
  eboekhoudenId?: number | null;
}

interface EboekhoudenRelation {
  id: number;
  company?: string;
  bedrijf?: string;
  Bedrijf?: string;
  name?: string;
  naam?: string;
  Naam?: string;
  code?: string;
  email?: string;
  Email?: string;
  phone?: string;
  Phone?: string;
  telefoon?: string;
}

interface ImportEboekhoudenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportEboekhoudenModal({ isOpen, onClose }: ImportEboekhoudenModalProps) {
  const [selectedRelations, setSelectedRelations] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // Fetch existing participants
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ['participants'],
    queryFn: () => participantsApi.getAll(),
    enabled: isOpen,
  });

  // Fetch e-Boekhouden relations
  const { data: relationsData, isLoading: isLoadingRelations, error: relationsError } = useQuery({
    queryKey: ['eboekhouden-relations'],
    queryFn: () => eboekhoudenApi.getRelations(),
    enabled: isOpen,
  });

  const relations: EboekhoudenRelation[] = useMemo(() => {
    if (!relationsData) return [];
    if (Array.isArray(relationsData)) return relationsData;
    return relationsData.relations || [];
  }, [relationsData]);

  // Build map of eboekhoudenId to participant
  const linkedByEboekhoudenId = useMemo(() => {
    const map = new Map<number, Participant>();
    for (const p of participants) {
      if (p.eboekhoudenId) {
        map.set(p.eboekhoudenId, p);
      }
    }
    return map;
  }, [participants]);

  // Build map of email to participant
  const linkedByEmail = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const p of participants) {
      if (p.email) {
        map.set(p.email.toLowerCase(), p);
      }
    }
    return map;
  }, [participants]);

  // Helper to get relation name
  const getRelationName = (rel: EboekhoudenRelation) => {
    return rel.company || rel.bedrijf || rel.Bedrijf || rel.name || rel.naam || rel.Naam || rel.code || `Relatie ${rel.id}`;
  };

  // Helper to get relation email
  const getRelationEmail = (rel: EboekhoudenRelation) => {
    return rel.email || rel.Email || undefined;
  };

  // Helper to get relation phone
  const getRelationPhone = (rel: EboekhoudenRelation) => {
    return rel.phone || rel.Phone || rel.telefoon || undefined;
  };

  // Determine status for each relation
  const getRelationStatus = (rel: EboekhoudenRelation): 'linked' | 'match' | 'new' => {
    if (linkedByEboekhoudenId.has(rel.id)) {
      return 'linked';
    }
    const email = getRelationEmail(rel);
    if (email && linkedByEmail.has(email.toLowerCase())) {
      return 'match';
    }
    return 'new';
  };

  // Filter relations by search
  const filteredRelations = useMemo(() => {
    if (!search.trim()) return relations;
    const searchLower = search.toLowerCase();
    return relations.filter((rel) => {
      const name = getRelationName(rel).toLowerCase();
      const email = (getRelationEmail(rel) || '').toLowerCase();
      return name.includes(searchLower) || email.includes(searchLower);
    });
  }, [relations, search]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const toImport = relations
        .filter((rel) => selectedRelations.has(rel.id))
        .map((rel) => ({
          id: rel.id,
          name: getRelationName(rel),
          email: getRelationEmail(rel),
          phone: getRelationPhone(rel),
        }));
      return participantsApi.importFromEboekhouden(toImport);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['eboekhouden-relations'] });
      setSelectedRelations(new Set());
      alert(`Import voltooid!\n\nNieuw aangemaakt: ${data.created}\nGekoppeld: ${data.linked}\nOvergeslagen: ${data.skipped}${data.errors?.length ? `\n\nFouten: ${data.errors.join(', ')}` : ''}`);
      onClose();
    },
    onError: (error: any) => {
      alert(`Import mislukt: ${error?.response?.data?.error || error?.message || 'Onbekende fout'}`);
    },
  });

  const toggleRelation = (id: number) => {
    const status = getRelationStatus(relations.find((r) => r.id === id)!);
    if (status === 'linked') return; // Can't select already linked

    setSelectedRelations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllImportable = () => {
    const importable = filteredRelations
      .filter((rel) => getRelationStatus(rel) !== 'linked')
      .map((rel) => rel.id);
    setSelectedRelations(new Set(importable));
  };

  const deselectAll = () => {
    setSelectedRelations(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full lg:max-w-2xl lg:rounded-xl rounded-t-xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold">Importeer uit e-Boekhouden</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and actions */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek relatie..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {selectedRelations.size} geselecteerd
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllImportable}
                  className="text-primary-600 hover:underline"
                >
                  Selecteer alle
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-gray-500 hover:underline"
                >
                  Deselecteer
                </button>
              </div>
            </div>
          </div>

          {/* Relations list */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingRelations ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Relaties laden...
              </div>
            ) : relationsError ? (
              <div className="p-4 text-center text-red-600">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                Fout bij laden relaties
              </div>
            ) : filteredRelations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {search ? 'Geen relaties gevonden' : 'Geen relaties in e-Boekhouden'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredRelations.map((rel) => {
                  const status = getRelationStatus(rel);
                  const name = getRelationName(rel);
                  const email = getRelationEmail(rel);
                  const linkedParticipant = status === 'linked'
                    ? linkedByEboekhoudenId.get(rel.id)
                    : status === 'match' && email
                      ? linkedByEmail.get(email.toLowerCase())
                      : null;

                  return (
                    <label
                      key={rel.id}
                      className={clsx(
                        'flex items-center gap-3 p-4 transition-colors',
                        status === 'linked'
                          ? 'bg-gray-50 cursor-not-allowed'
                          : selectedRelations.has(rel.id)
                            ? 'bg-primary-50 cursor-pointer'
                            : 'hover:bg-gray-50 cursor-pointer'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRelations.has(rel.id)}
                        onChange={() => toggleRelation(rel.id)}
                        disabled={status === 'linked'}
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 disabled:opacity-50"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={clsx(
                            'font-medium truncate',
                            status === 'linked' ? 'text-gray-500' : 'text-gray-900'
                          )}>
                            {name}
                          </p>
                          {status === 'linked' && (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Gekoppeld
                            </span>
                          )}
                          {status === 'match' && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <LinkIcon className="w-3 h-3" />
                              Match
                            </span>
                          )}
                          {status === 'new' && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              <Plus className="w-3 h-3" />
                              Nieuw
                            </span>
                          )}
                        </div>
                        {email && (
                          <p className="text-sm text-gray-500 truncate">{email}</p>
                        )}
                        {linkedParticipant && (
                          <p className="text-xs text-gray-400 mt-1">
                            {status === 'linked' ? 'Gekoppeld aan' : 'Wordt gekoppeld aan'}: {linkedParticipant.name}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

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
            onClick={() => importMutation.mutate()}
            disabled={selectedRelations.size === 0 || importMutation.isPending}
            className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            {importMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Importeren ({selectedRelations.size})
          </button>
        </div>
      </div>
    </div>
  );
}
