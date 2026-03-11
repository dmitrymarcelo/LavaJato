import React, { useState } from 'react';
import { Shield, UserCog, CheckCircle2, XCircle, Save, Info, Lock, Eye, Edit3, Trash2, BarChart3, Users, UserPlus, Star, Clock, MoreVertical, Search, Filter, ShieldCheck, Car, Bike, Truck, Ship, Plus, Upload, FileSpreadsheet, Download } from 'lucide-react';
import { RoleAccessRule, Screen, TeamMember, VehicleCategory, VehicleType, ServiceTypeOption, VehicleRegistration } from '../types';
import { motion, AnimatePresence } from '../lib/motion';
import { digitsOnly, formatCpf, generateId, isValidCpf, optimizeImageFile, validateStrongPassword } from '../utils/app';
import { BASES } from '../data/bases';
import ModalSurface from './ModalSurface';

interface Permission {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const PERMISSIONS: Permission[] = [
  { id: 'view_analytics', label: 'Ver Relatórios', description: 'Acesso total ao módulo de produtividade e faturamento.', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'manage_team', label: 'Gerenciar Equipe', description: 'Adicionar, editar ou remover membros da equipe.', icon: <UserCog className="w-4 h-4" /> },
  { id: 'edit_services', label: 'Editar Serviços', description: 'Alterar preços ou tipos de serviços em andamento.', icon: <Edit3 className="w-4 h-4" /> },
  { id: 'delete_services', label: 'Excluir Serviços', description: 'Remover registros de serviços do sistema.', icon: <Trash2 className="w-4 h-4" /> },
  { id: 'bypass_inspection', label: 'Pular Inspeção', description: 'Permitir iniciar lavagem sem fotos obrigatórias.', icon: <Eye className="w-4 h-4" /> },
  { id: 'manage_b2b', label: 'Base', description: 'Controlar a base que o cliente pode acompanhar na agenda e fila.', icon: <Shield className="w-4 h-4" /> },
];

const INITIAL_RULES: RoleAccessRule[] = [
  { role: 'Administrador', permissions: PERMISSIONS.map(p => p.id) },
  { role: 'Lavador', permissions: [] },
  { role: 'Clientes', permissions: ['manage_b2b'] },
];

export default function Settings({ 
  onNavigate, 
  serviceTypes, 
  onUpdateServiceTypes,
  vehicleDb,
  onUpdateVehicleDb,
  team: teamProp,
  onUpdateTeam,
  accessRules,
  onUpdateAccessRules,
}: { 
  onNavigate: (screen: Screen) => void, 
  serviceTypes?: Record<VehicleType, VehicleCategory>, 
  onUpdateServiceTypes?: (types: Record<VehicleType, VehicleCategory>) => Promise<void> | void,
  vehicleDb?: VehicleRegistration[],
  onUpdateVehicleDb?: (db: VehicleRegistration[]) => Promise<void> | void,
  team?: TeamMember[],
  onUpdateTeam?: (team: TeamMember[]) => Promise<void> | void,
  accessRules?: RoleAccessRule[],
  onUpdateAccessRules?: (rules: RoleAccessRule[]) => Promise<void> | void
}) {
  const [rules, setRules] = useState<RoleAccessRule[]>(accessRules?.length ? accessRules : INITIAL_RULES);
  const [activeRole, setActiveRole] = useState<string>('Administrador');
  const [activeTab, setActiveTab] = useState<'access' | 'services' | 'database'>('access');
  const [isSaving, setIsSaving] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>(teamProp ?? []);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [editingService, setEditingService] = useState<{ vehicle: VehicleType, service: ServiceTypeOption } | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceFormVehicle, setServiceFormVehicle] = useState<VehicleType>('car');
  const [serviceFormLabel, setServiceFormLabel] = useState('');
  const [serviceFormPrice, setServiceFormPrice] = useState('');
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<VehicleRegistration>>({ type: 'car' });
  const newVehicleCpfError = newVehicle.thirdPartyCpf ? (!isValidCpf(newVehicle.thirdPartyCpf) ? 'CPF invalido.' : null) : null;

  const filteredTeam = team.filter(member => 
    member.role === activeRole && (
      member.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredDb = vehicleDb?.filter(v => 
    v.plate.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
    v.customer.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
    v.model.toLowerCase().includes(dbSearchQuery.toLowerCase())
  ) || [];

  const togglePermission = (roleName: string, permissionId: string) => {
    setRules(prev => prev.map(r => {
      if (r.role === roleName) {
        const hasPermission = r.permissions.includes(permissionId);
        return {
          ...r,
          permissions: hasPermission 
            ? r.permissions.filter(id => id !== permissionId)
            : [...r.permissions, permissionId]
        };
      }
      return r;
    }));
  };

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRegistration, setNewMemberRegistration] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberAvatar, setNewMemberAvatar] = useState('');
  const [newMemberAllowedBaseIds, setNewMemberAllowedBaseIds] = useState<string[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const newMemberPasswordError = newMemberPassword ? validateStrongPassword(newMemberPassword) : null;

  React.useEffect(() => {
    setRules(accessRules?.length ? accessRules : INITIAL_RULES);
    setTeam(teamProp ?? []);
  }, [accessRules, teamProp]);

  const resetMemberForm = () => {
    setEditingMemberId(null);
    setNewMemberName('');
    setNewMemberRegistration('');
    setNewMemberPassword('');
    setNewMemberAvatar('');
    setNewMemberAllowedBaseIds([]);
    setIsAddingMember(false);
  };

  const handleMemberAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem valido.');
      return;
    }

    optimizeImageFile(file, { maxWidth: 720, maxHeight: 720, quality: 0.68 })
      .then((imageData) => {
        setNewMemberAvatar(imageData);
      })
      .catch((error) => {
        console.error(error);
        alert(error instanceof Error ? error.message : 'Nao foi possivel processar a foto do colaborador.');
      });
    event.target.value = '';
  };

  const handleAddMember = async () => {
    const existingMember = editingMemberId ? team.find((member) => member.id === editingMemberId) : null;

    if (!newMemberName.trim() || !newMemberRegistration.trim() || (!editingMemberId && !newMemberPassword.trim())) {
      alert('Preencha todos os campos.');
      return;
    }

    if (newMemberPassword && newMemberPasswordError) {
      alert(newMemberPasswordError);
      return;
    }

    if (activeRole === 'Clientes' && newMemberAllowedBaseIds.length === 0) {
      alert('Selecione ao menos uma base para este cliente.');
      return;
    }

    const newMember: TeamMember = {
      id: editingMemberId || generateId(),
      name: newMemberName,
      registration: newMemberRegistration,
      password: newMemberPassword || undefined,
      role: activeRole,
      allowedBaseIds: activeRole === 'Clientes' ? newMemberAllowedBaseIds : [],
      rating: existingMember?.rating || 5.0,
      servicesCount: existingMember?.servicesCount || 0,
      status: existingMember?.status || 'active',
      avatar: newMemberAvatar || existingMember?.avatar || `https://i.pravatar.cc/150?u=${generateId()}`,
      efficiency: existingMember?.efficiency || '100%'
    };

    const updatedTeam = editingMemberId
      ? team.map((member) => member.id === editingMemberId ? { ...member, ...newMember, password: newMemberPassword || undefined } : member)
      : [...team, newMember];
    setTeam(updatedTeam);
    await onUpdateTeam?.(updatedTeam);
    
    resetMemberForm();
    alert(editingMemberId ? 'Colaborador atualizado com sucesso!' : 'Colaborador adicionado com sucesso!');
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este colaborador?')) {
      const updatedTeam = team.filter(m => m.id !== id);
      setTeam(updatedTeam);
      await onUpdateTeam?.(updatedTeam);
      setOpenMenuId(null);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setNewMemberName(member.name);
    setNewMemberRegistration(member.registration);
    setNewMemberPassword('');
    setNewMemberAvatar(member.avatar);
    setNewMemberAllowedBaseIds(member.allowedBaseIds || []);
    setIsAddingMember(true);
    setOpenMenuId(null);
  };

  const toggleAllowedBase = (baseId: string) => {
    setNewMemberAllowedBaseIds((prev) =>
      prev.includes(baseId)
        ? prev.filter((id) => id !== baseId)
        : [...prev, baseId]
    );
  };

  const handleSave = () => {
    setIsSaving(true);
    Promise.resolve(onUpdateAccessRules?.(rules))
      .then(() => {
      setIsSaving(false);
      alert('Configurações atualizadas com sucesso!');
      })
      .catch((error) => {
        console.error(error);
        setIsSaving(false);
        alert(error instanceof Error ? error.message : 'Nao foi possivel salvar as configuracoes.');
      });
  };

  const handleUpdateService = (vehicle: VehicleType, serviceId: string, field: keyof ServiceTypeOption, value: string | number) => {
    if (!serviceTypes || !onUpdateServiceTypes) return;

    const updatedTypes = { ...serviceTypes };
    const vehicleServices = [...updatedTypes[vehicle].services];
    const serviceIndex = vehicleServices.findIndex(s => s.id === serviceId);

    if (serviceIndex !== -1) {
      vehicleServices[serviceIndex] = {
        ...vehicleServices[serviceIndex],
        [field]: value
      };
      updatedTypes[vehicle] = {
        ...updatedTypes[vehicle],
        services: vehicleServices
      };
      onUpdateServiceTypes(updatedTypes);
    }
  };

  const getVehicleTypeLabel = (type: VehicleType) => {
    if (type === 'car') return 'Carro';
    if (type === 'motorcycle') return 'Moto';
    if (type === 'truck') return 'Caminhão';
    if (type === 'pickup_4x4') return 'Caminhonete 4X4';
    return 'Lancha';
  };

  const resetServiceForm = () => {
    setEditingService(null);
    setServiceFormVehicle('car');
    setServiceFormLabel('');
    setServiceFormPrice('');
    setIsServiceModalOpen(false);
  };

  const openNewServiceModal = (vehicle?: VehicleType) => {
    setEditingService(null);
    setServiceFormVehicle(vehicle || 'car');
    setServiceFormLabel('');
    setServiceFormPrice('');
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (vehicle: VehicleType, service: ServiceTypeOption) => {
    setEditingService({ vehicle, service });
    setServiceFormVehicle(vehicle);
    setServiceFormLabel(service.label);
    setServiceFormPrice(String(service.price));
    setIsServiceModalOpen(true);
  };

  const handleSaveServiceForm = async () => {
    if (!serviceTypes || !onUpdateServiceTypes) return;

    const normalizedLabel = serviceFormLabel.trim();
    const normalizedPrice = Number(serviceFormPrice);

    if (!normalizedLabel) {
      alert('Informe o nome do serviço.');
      return;
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      alert('Informe um valor válido para o serviço.');
      return;
    }

    const updatedTypes = { ...serviceTypes };
    if (!updatedTypes[serviceFormVehicle]) {
      updatedTypes[serviceFormVehicle] = {
        label: getVehicleTypeLabel(serviceFormVehicle),
        services: [],
      };
    }

    if (editingService) {
      updatedTypes[editingService.vehicle] = {
        ...updatedTypes[editingService.vehicle],
        services: updatedTypes[editingService.vehicle].services.filter(
          (service) => service.id !== editingService.service.id
        ),
      };
    }

    const nextService: ServiceTypeOption = {
      id: editingService?.service.id || generateId(),
      label: normalizedLabel,
      price: normalizedPrice,
    };

    updatedTypes[serviceFormVehicle] = {
      ...updatedTypes[serviceFormVehicle],
      services: [...updatedTypes[serviceFormVehicle].services, nextService],
    };

    await onUpdateServiceTypes(updatedTypes);
    resetServiceForm();
  };

  const handleDeleteServiceType = async (vehicle: VehicleType, serviceId: string) => {
    if (!serviceTypes || !onUpdateServiceTypes) return;

    if (!confirm('Tem certeza que deseja excluir este serviço?')) {
      return;
    }

    const updatedTypes = { ...serviceTypes };
    updatedTypes[vehicle] = {
      ...updatedTypes[vehicle],
      services: updatedTypes[vehicle].services.filter((service) => service.id !== serviceId),
    };

    await onUpdateServiceTypes(updatedTypes);
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.plate || !newVehicle.customer || !newVehicle.model) {
      alert('Preencha placa, cliente e modelo.');
      return;
    }

    if ((newVehicle.thirdPartyName || newVehicle.thirdPartyCpf) && newVehicleCpfError) {
      alert(newVehicleCpfError);
      return;
    }
    
    if (onUpdateVehicleDb) {
      const currentDb = vehicleDb || [];
      await onUpdateVehicleDb([...currentDb, {
        ...newVehicle,
        thirdPartyCpf: newVehicle.thirdPartyCpf ? digitsOnly(newVehicle.thirdPartyCpf) : undefined
      } as VehicleRegistration]);
      setIsAddingVehicle(false);
      setNewVehicle({ type: 'car' });
      alert('Veículo cadastrado com sucesso!');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const newVehicles: VehicleRegistration[] = [];

      // Skip header row if exists (assuming first row is header based on prompt)
      // The prompt shows header: cod_veic;cod_cliente;...
      const startIndex = lines[0].includes('cod_veic') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by semicolon as per the example
        const cols = line.split(';');
        
        // Mapping based on the provided CSV structure:
        // cod_placa is index 3 (0-based) -> "=""AAA0003"""
        // proprietario is index 13
        // marca_modelo is index 27
        // tipo_veiculo is index 10
        // cidade is index 8
        // estado is index 11
        
        if (cols.length < 14) continue; // Basic validation

        // Clean up plate: remove "="" and """
        let plate = cols[3]?.replace(/[="]/g, '').trim() || '';
        const customer = cols[13]?.replace(/["]/g, '').trim() || 'Desconhecido';
        const model = cols[27]?.replace(/["]/g, '').trim() || 'Modelo Desconhecido';
        const rawType = cols[10]?.replace(/["]/g, '').trim().toUpperCase() || '';
        const city = cols[8]?.replace(/["]/g, '').trim();
        const state = cols[11]?.replace(/["]/g, '').trim();

        let type: VehicleType = 'car';
        if (rawType.includes('MOTO')) type = 'motorcycle';
        else if (rawType.includes('CAMINHAO') || rawType.includes('CAMINHÃO')) type = 'truck';
        else if (rawType.includes('LANCHA') || rawType.includes('BARCO') || rawType.includes('REBOQUE')) type = 'boat';
        // Default to car for PASSEIO, PICAPE, VAN, etc.

        if (plate) {
          newVehicles.push({
            plate,
            customer,
            model,
            type,
            city,
            state
          });
        }
      }

      if (onUpdateVehicleDb) {
        // Merge with existing or replace? Usually import adds/updates.
        // Let's replace for now as it seems to be a full base import, or we can append.
        // To be safe and avoid duplicates, we can use a Map.
        const currentDb = vehicleDb || [];
        const dbMap = new Map(currentDb.map(v => [v.plate, v]));
        
        newVehicles.forEach(v => {
          dbMap.set(v.plate, v);
        });

        await onUpdateVehicleDb(Array.from(dbMap.values()));
        alert(`${newVehicles.length} veículos importados com sucesso!`);
      }
    };
    reader.readAsText(file);
  };

  const currentRoleRules = rules.find(r => r.role === activeRole);
  const visiblePermissions = activeRole === 'Clientes'
    ? PERMISSIONS.filter((permission) => permission.id === 'manage_b2b')
    : PERMISSIONS;

  return (
    <div className="flex flex-col min-h-full bg-white pb-24">
      {/* Tabs */}
      <div className="flex px-6 border-b border-slate-100 overflow-x-auto no-scrollbar pt-6">
        <button 
          onClick={() => setActiveTab('access')}
          className={`pb-4 pt-2 px-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'access' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
        >
          Acesso & Equipe
        </button>
        <button 
          onClick={() => setActiveTab('services')}
          className={`pb-4 pt-2 px-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'services' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
        >
          Serviços & Preços
        </button>
        <button 
          onClick={() => setActiveTab('database')}
          className={`pb-4 pt-2 px-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'database' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
        >
          Cadastros de Clientes
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        {activeTab === 'access' ? (
          <>
            {/* Role Sidebar */}
            <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-100 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2 mb-4">Níveis de Acesso</p>
              {rules.map((r) => (
                <button
                  key={r.role}
                  onClick={() => setActiveRole(r.role)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                    activeRole === r.role 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-sm">{r.role}</span>
                  {activeRole === r.role && <CheckCircle2 className="w-4 h-4" />}
                </button>
              ))}
            </div>

            {/* Permissions List */}
            <div className="flex-1 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Permissões para {activeRole}</h3>
                  <p className="text-xs text-slate-500">Habilite ou desabilite as funcionalidades abaixo.</p>
                </div>
                {activeRole === 'Administrador' && (
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100">
                    <Lock className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Acesso Total</span>
                  </div>
                )}
              </div>

              {activeRole === 'Clientes' && (
                <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs font-medium text-primary">
                  A definição de quais filiais cada cliente pode acessar e usar no agendamento é feita no cadastro individual do usuário logo abaixo.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visiblePermissions.map((perm) => {
                  const isEnabled = currentRoleRules?.permissions.includes(perm.id);
                  const isDisabled = activeRole === 'Administrador';

                  return (
                    <div 
                      key={perm.id}
                      onClick={() => !isDisabled && togglePermission(activeRole, perm.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                        isEnabled 
                          ? 'border-primary/20 bg-primary/5' 
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      } ${isDisabled ? 'opacity-80 cursor-default' : 'active:scale-[0.98]'}`}
                    >
                      <div className={`p-2 rounded-xl ${isEnabled ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {perm.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-900">{perm.label}</p>
                          <div className={`w-10 h-5 rounded-full relative transition-colors ${isEnabled ? 'bg-primary' : 'bg-slate-200'}`}>
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isEnabled ? 'right-1' : 'left-1'}`} />
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{perm.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  As alterações feitas aqui entrarão em vigor imediatamente para todos os usuários vinculados a este nível de acesso. 
                  Certifique-se de revisar as permissões de segurança antes de salvar.
                </p>
              </div>

              {/* Team Management Section */}
              <div className="pt-8 border-t border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Membros da Equipe ({activeRole})</h3>
                    <p className="text-xs text-slate-500">Gerencie os colaboradores vinculados a este nível de acesso.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingMemberId(null);
                      setNewMemberName('');
                      setNewMemberRegistration('');
                      setNewMemberPassword('');
                      setNewMemberAvatar('');
                      setNewMemberAllowedBaseIds([]);
                      setIsAddingMember(true);
                    }}
                    className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>ADICIONAR</span>
                  </button>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-900"
                  />
                </div>

                <div className="space-y-3">
                  {filteredTeam.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-medium">Nenhum {activeRole} encontrado</p>
                    </div>
                  ) : (
                    filteredTeam.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group"
                      >
                        <div className="relative">
                          <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            member.status === 'active' ? 'bg-emerald-500' :
                            member.status === 'break' ? 'bg-amber-500' : 'bg-slate-300'
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900 truncate">{member.name}</h4>
                            {member.role.includes('Líder') && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                              <span className="text-[9px] font-bold text-slate-700">{member.rating}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                              <span className="text-[9px] font-bold text-slate-700">{member.servicesCount} serv.</span>
                            </div>
                          </div>
                          {member.role === 'Clientes' && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(member.allowedBaseIds || []).length === 0 ? (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full">
                                  Nenhuma base liberada
                                </span>
                              ) : (
                                (member.allowedBaseIds || []).map((baseId) => {
                                  const base = BASES.find((item) => item.id === baseId);
                                  return (
                                    <span key={baseId} className="text-[9px] font-bold text-primary bg-primary/5 border border-primary/10 px-2 py-1 rounded-full">
                                      {base?.name || baseId}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {openMenuId === member.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                                <button
                                  onClick={() => handleEditMember(member)}
                                  className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Editar
                                </button>
                                <button 
                                  onClick={() => handleDeleteMember(member.id)}
                                  className="w-full text-left px-4 py-3 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Excluir
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'services' ? (
          <div className="flex-1 p-6 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Serviços por tipo de veículo</h3>
                <p className="text-xs text-slate-500">Cadastre e edite os serviços com nome, valor e categoria do veículo.</p>
              </div>
              <button
                onClick={() => openNewServiceModal()}
                className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Serviço</span>
              </button>
            </div>

            {serviceTypes && Object.entries(serviceTypes).map(([type, category]) => (
              <div key={type} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                      {type === 'car' && <Car className="w-5 h-5" />}
                      {type === 'motorcycle' && <Bike className="w-5 h-5" />}
                      {type === 'truck' && <Truck className="w-5 h-5" />}
                      {type === 'boat' && <Ship className="w-5 h-5" />}
                    </div>
                    <h3 className="text-lg font-black text-slate-900">{category.label}</h3>
                  </div>
                  <button
                    onClick={() => openNewServiceModal(type as VehicleType)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {category.services.map((service) => (
                    <div key={service.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{service.label}</p>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mt-1">
                          {getVehicleTypeLabel(type as VehicleType)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor</p>
                          <p className="text-lg font-black text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
                          </p>
                        </div>
                        <button
                          onClick={() => openEditServiceModal(type as VehicleType, service)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteServiceType(type as VehicleType, service.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Base de Veículos e Centros de Custo</h3>
                <p className="text-xs text-slate-500">Importe dados via CSV ou gerencie cadastros manualmente.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAddingVehicle(true)}
                  className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Cadastro</span>
                </button>
                <label className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-all shadow-sm cursor-pointer hover:bg-slate-50 hover:border-primary hover:text-primary">
                  <Upload className="w-4 h-4" />
                  <span>Importar CSV</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900 mb-1">Formato do Arquivo CSV</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  O arquivo deve usar ponto e vírgula (;) como separador. As colunas esperadas são: cod_veic; cod_cliente; ...; cod_placa (col 4); ...; proprietario (col 14); ...; marca_modelo (col 28).
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por placa, centro de custo ou modelo..."
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-900"
              />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Placa</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Centro de Custo</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Veículo</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Local</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDb.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                          Nenhum registro encontrado. Importe uma base de dados.
                        </td>
                      </tr>
                    ) : (
                      filteredDb.slice(0, 50).map((vehicle, i) => (
                        <tr key={`${vehicle.plate}-${i}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-black text-slate-900">{vehicle.plate}</td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-600">
                            {vehicle.customer}
                            {vehicle.thirdPartyName && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Terceiro: {vehicle.thirdPartyName}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{vehicle.model}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                              vehicle.type === 'car' ? 'bg-blue-50 text-blue-600' :
                              vehicle.type === 'motorcycle' ? 'bg-amber-50 text-amber-600' :
                              vehicle.type === 'truck' ? 'bg-purple-50 text-purple-600' :
                              'bg-cyan-50 text-cyan-600'
                            }`}>
                              {vehicle.type === 'car' ? 'Carro' : 
                               vehicle.type === 'motorcycle' ? 'Moto' : 
                               vehicle.type === 'truck' ? 'Caminhão' : 'Lancha'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{vehicle.city} - {vehicle.state}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredDb.length > 50 && (
                <div className="p-3 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-400">Exibindo 50 de {filteredDb.length} registros</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddingMember && (
          <ModalSurface onClose={resetMemberForm} panelClassName="max-w-[400px] p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">{editingMemberId ? `Editar ${activeRole}` : `Novo ${activeRole}`}</h3>
                <button onClick={resetMemberForm} className="text-slate-400 hover:text-slate-600 font-bold">Fechar</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Carlos Alberto"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary transition-all text-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Foto do Colaborador</label>
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm shrink-0">
                      <img
                        src={newMemberAvatar || 'https://i.pravatar.cc/150?u=preview-member'}
                        alt="Preview do colaborador"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                        <Upload className="w-4 h-4" />
                        <span>Carregar Foto</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleMemberAvatarUpload} />
                      </label>
                      <p className="text-[10px] text-slate-400">Use uma foto do dispositivo para identificar o colaborador nas etapas do processo.</p>
                      {newMemberAvatar && (
                        <button
                          type="button"
                          onClick={() => setNewMemberAvatar('')}
                          className="text-[10px] font-bold uppercase tracking-widest text-rose-500"
                        >
                          Remover Foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Matrícula</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 1001"
                    value={newMemberRegistration}
                    onChange={(e) => setNewMemberRegistration(digitsOnly(e.target.value))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={12}
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary transition-all text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Senha</label>
                  <input 
                    type="password" 
                    placeholder={editingMemberId ? 'Deixe em branco para manter a atual' : '••••••••'}
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    minLength={editingMemberId ? undefined : 12}
                    autoComplete="new-password"
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary transition-all text-slate-900"
                  />
                  <p className={`text-[10px] font-bold ml-1 ${newMemberPasswordError ? 'text-rose-500' : 'text-slate-400'}`}>
                    {newMemberPasswordError || (editingMemberId ? 'Opcional na edicao. Se informar, a senha precisa seguir a regra forte.' : 'Senha forte: 12+ caracteres, maiuscula, minuscula, numero e simbolo.')}
                  </p>
                </div>

                {activeRole === 'Clientes' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Bases Permitidas</label>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                      {BASES.map((base) => {
                        const checked = newMemberAllowedBaseIds.includes(base.id);
                        return (
                          <label key={base.id} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAllowedBase(base.id)}
                              className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700">{base.name}</span>
                              <span className="text-[10px] font-medium text-slate-400">{base.responsible}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] font-bold ml-1 text-slate-400">
                      Defina exatamente em quais filiais este cliente podera consultar e agendar.
                    </p>
                  </div>
                )}
                
                <div className="pt-2">
                  <button 
                    onClick={handleAddMember}
                    disabled={!!newMemberPasswordError}
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-70"
                  >
                    {editingMemberId ? 'Salvar Alteracoes' : 'Confirmar Cadastro'}
                  </button>
                </div>
              </div>
          </ModalSurface>
        )}

        {/* Add Vehicle Modal */}
        {isAddingVehicle && (
          <ModalSurface onClose={() => setIsAddingVehicle(false)} panelClassName="max-w-[400px] p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">Novo Veículo</h3>
                <button onClick={() => setIsAddingVehicle(false)} className="text-slate-400 hover:text-slate-600 font-bold">Fechar</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Placa</label>
                  <input 
                    type="text" 
                    placeholder="Ex: ABC-1234"
                    value={newVehicle.plate || ''}
                    onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900 font-bold uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Centro de Custo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: João Silva"
                    value={newVehicle.customer || ''}
                    onChange={(e) => setNewVehicle({...newVehicle, customer: e.target.value})}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                  />
                  
                  <label className="flex items-center gap-2 mt-2 ml-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={!!newVehicle.thirdPartyName || !!newVehicle.thirdPartyCpf}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setNewVehicle({...newVehicle, thirdPartyName: undefined, thirdPartyCpf: undefined});
                        } else {
                          setNewVehicle({...newVehicle, thirdPartyName: '', thirdPartyCpf: ''});
                        }
                      }}
                      className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                    />
                    <span className="text-sm font-bold text-slate-600">Cadastro para Terceiro</span>
                  </label>

                  {(newVehicle.thirdPartyName !== undefined || newVehicle.thirdPartyCpf !== undefined) && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <input 
                        type="text"
                        value={newVehicle.thirdPartyName || ''}
                        onChange={(e) => setNewVehicle({...newVehicle, thirdPartyName: e.target.value})}
                        placeholder="Nome do Terceiro"
                        className="w-full rounded-xl border border-slate-200 bg-white h-12 px-4 text-slate-900 font-medium focus:border-primary focus:ring-0 transition-all shadow-sm text-sm"
                      />
                      <input 
                        type="text"
                        value={newVehicle.thirdPartyCpf || ''}
                        onChange={(e) => setNewVehicle({...newVehicle, thirdPartyCpf: formatCpf(e.target.value)})}
                        placeholder="CPF do Terceiro"
                        inputMode="numeric"
                        maxLength={14}
                        className="w-full rounded-xl border border-slate-200 bg-white h-12 px-4 text-slate-900 font-medium focus:border-primary focus:ring-0 transition-all shadow-sm text-sm"
                      />
                    </div>
                  )}
                  {(newVehicle.thirdPartyName !== undefined || newVehicle.thirdPartyCpf !== undefined) && (
                    <p className={`text-[10px] font-bold ml-1 ${newVehicleCpfError ? 'text-rose-500' : 'text-slate-400'}`}>
                      {newVehicleCpfError || 'CPF valido em formato 000.000.000-00.'}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Modelo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Corolla"
                    value={newVehicle.model || ''}
                    onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Tipo</label>
                  <select 
                    value={newVehicle.type || 'car'}
                    onChange={(e) => setNewVehicle({...newVehicle, type: e.target.value as VehicleType})}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-primary transition-all text-slate-900"
                  >
                    <option value="car">Carro</option>
                    <option value="motorcycle">Moto</option>
                    <option value="truck">Caminhão</option>
                    <option value="boat">Lancha</option>
                  </select>
                </div>
                
                <div className="pt-2">
                  <button 
                    onClick={handleAddVehicle}
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                  >
                    Confirmar Cadastro
                  </button>
                </div>
              </div>
          </ModalSurface>
        )}

        {isServiceModalOpen && (
          <ModalSurface onClose={resetServiceForm} panelClassName="max-w-[420px] p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">
                  {editingService ? 'Editar Serviço' : 'Adicionar Serviço'}
                </h3>
                <button onClick={resetServiceForm} className="text-slate-400 hover:text-slate-600 font-bold">
                  Fechar
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Tipo de Veículo</label>
                  <select
                    value={serviceFormVehicle}
                    onChange={(e) => setServiceFormVehicle(e.target.value as VehicleType)}
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary transition-all text-slate-900"
                  >
                    <option value="car">Carro</option>
                    <option value="motorcycle">Moto</option>
                    <option value="pickup_4x4">Caminhonete 4X4</option>
                    <option value="boat">Lancha</option>
                    <option value="truck">Caminhão</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Tipo de Serviço</label>
                  <input
                    type="text"
                    placeholder="Ex: Lavagem Completa"
                    value={serviceFormLabel}
                    onChange={(e) => setServiceFormLabel(e.target.value)}
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary transition-all text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Valor</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={serviceFormPrice}
                    onChange={(e) => setServiceFormPrice(e.target.value)}
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-primary transition-all text-slate-900"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveServiceForm}
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                  >
                    {editingService ? 'Salvar Alterações' : 'Cadastrar Serviço'}
                  </button>
                </div>
              </div>
          </ModalSurface>
        )}
      </AnimatePresence>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-72 bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 flex justify-end z-30">
        <div className="flex gap-3 w-full max-w-md">
          <button 
            onClick={() => onNavigate('dashboard')}
            className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

