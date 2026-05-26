import React, { useState } from 'react';
import { motion } from '../lib/motion';
import {
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  Lock,
  Mail,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import { getSafeLogoSrc } from '../lib/placeholders';
import { BASES } from '../data/bases';
import { VehicleType } from '../types';
import { ClientSignupPayload } from '../services/api';

interface LoginProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
  onClientSignup: (payload: ClientSignupPayload) => Promise<void>;
}

type AuthMode = 'login' | 'signup';

interface SignupVehicleForm {
  plate: string;
  model: string;
  type: VehicleType;
}

const VEHICLE_TYPE_OPTIONS: Array<{ value: VehicleType; label: string }> = [
  { value: 'car', label: 'Carro' },
  { value: 'motorcycle', label: 'Moto' },
  { value: 'pickup_4x4', label: 'Picape Media' },
  { value: 'truck', label: 'Caminhao' },
  { value: 'boat', label: 'Lancha' },
];

const createVehicleRow = (): SignupVehicleForm => ({
  plate: '',
  model: '',
  type: 'car',
});

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

export default function Login({ onLogin, onClientSignup }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientPasswordConfirm, setClientPasswordConfirm] = useState('');
  const [clientBaseId, setClientBaseId] = useState(BASES[0]?.id || '');
  const [clientVehicles, setClientVehicles] = useState<SignupVehicleForm[]>([createVehicleRow()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  };

  const updateClientVehicle = (index: number, patch: Partial<SignupVehicleForm>) => {
    setClientVehicles((current) => current.map((vehicle, itemIndex) => (
      itemIndex === index ? { ...vehicle, ...patch } : vehicle
    )));
  };

  const addClientVehicle = () => {
    setClientVehicles((current) => [...current, createVehicleRow()]);
  };

  const removeClientVehicle = (index: number) => {
    setClientVehicles((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [createVehicleRow()];
    });
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsLoading(true);
    setError(null);
    try {
      await onLogin(identifier.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const vehicles = clientVehicles.map((vehicle) => ({
      plate: normalizePlate(vehicle.plate),
      model: vehicle.model.trim(),
      type: vehicle.type,
    }));

    if (!clientName.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }

    if (!clientEmail.trim()) {
      setError('Informe o email do cliente.');
      return;
    }

    if (clientPassword !== clientPasswordConfirm) {
      setError('A confirmacao da senha nao confere.');
      return;
    }

    if (vehicles.some((vehicle) => !vehicle.plate || !vehicle.model)) {
      setError('Preencha placa e modelo de todos os veiculos.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onClientSignup({
        name: clientName.trim(),
        email: clientEmail.trim(),
        password: clientPassword,
        confirmPassword: clientPasswordConfirm,
        baseId: clientBaseId,
        vehicles,
      });
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel criar o cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-200/60 grid lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden lg:flex flex-col justify-between bg-slate-950 text-white p-10">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={getSafeLogoSrc()}
                alt="Norte Tech Logo"
                className="w-12 h-12 object-contain"
                referrerPolicy="no-referrer"
              />
              <h1 className="text-2xl font-black tracking-tight">
                Norte <span className="text-sky-300">Tech</span>
              </h1>
            </div>

            <div className="mt-14 space-y-5">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-sky-200">Acesso do cliente</p>
              <h2 className="text-4xl font-black leading-tight tracking-tight">
                Login e cadastro direto para agendar lavagens.
              </h2>
              <p className="text-base font-medium leading-7 text-slate-300">
                O cliente entra, cadastra seus veiculos e ja acessa a agenda da base liberada.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3">
              <ShieldCheck className="w-5 h-5 text-sky-200" />
              <span className="text-sm font-bold text-slate-100">Permissao automatica como Clientes</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3">
              <Car className="w-5 h-5 text-sky-200" />
              <span className="text-sm font-bold text-slate-100">Veiculos vinculados ao cadastro</span>
            </div>
          </div>
        </aside>

        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full px-5 py-7 sm:px-8 lg:px-10 lg:py-10"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src={getSafeLogoSrc()}
              alt="Norte Tech Logo"
              className="w-11 h-11 object-contain"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Norte <span className="text-primary">Tech</span>
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 mb-8">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`h-12 rounded-xl text-sm font-black transition-all ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`h-12 rounded-xl text-sm font-black transition-all ${mode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Criar conta
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bem-vindo de volta</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">Acesse com matricula ou email.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                  Matricula ou email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="1001 ou cliente@empresa.com"
                    autoComplete="username"
                    inputMode="text"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group w-fit">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all" />
                  <CheckCircle2 className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Manter conectado</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-primary/20 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-5">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cadastro de cliente</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">Crie seu acesso e vincule seus veiculos.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Nome ou empresa</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      placeholder="Ex: Transportes Norte"
                      autoComplete="organization"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(event) => setClientEmail(event.target.value)}
                      placeholder="cliente@empresa.com"
                      autoComplete="email"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={clientPassword}
                      onChange={(event) => setClientPassword(event.target.value)}
                      placeholder="Senha forte"
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={clientPasswordConfirm}
                      onChange={(event) => setClientPasswordConfirm(event.target.value)}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Base de atendimento</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    value={clientBaseId}
                    onChange={(event) => setClientBaseId(event.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none"
                  >
                    {BASES.map((base) => (
                      <option key={base.id} value={base.id}>{base.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Veiculos</p>
                    <p className="text-xs font-medium text-slate-400">Cadastre pelo menos um para liberar agenda.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addClientVehicle}
                    className="h-10 px-3 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {clientVehicles.map((vehicle, index) => (
                    <div key={index} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_1.2fr_1fr_auto]">
                      <div className="relative">
                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={vehicle.plate}
                          onChange={(event) => updateClientVehicle(index, { plate: normalizePlate(event.target.value) })}
                          placeholder="Placa"
                          className="w-full h-12 bg-white border border-slate-100 rounded-xl pl-10 pr-3 font-black uppercase text-slate-900 focus:border-primary outline-none"
                        />
                      </div>

                      <input
                        type="text"
                        required
                        value={vehicle.model}
                        onChange={(event) => updateClientVehicle(index, { model: event.target.value })}
                        placeholder="Modelo"
                        className="w-full h-12 bg-white border border-slate-100 rounded-xl px-3 font-bold text-slate-900 focus:border-primary outline-none"
                      />

                      <select
                        value={vehicle.type}
                        onChange={(event) => updateClientVehicle(index, { type: event.target.value as VehicleType })}
                        className="w-full h-12 bg-white border border-slate-100 rounded-xl px-3 font-bold text-slate-900 focus:border-primary outline-none appearance-none"
                      >
                        {VEHICLE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeClientVehicle(index)}
                        className="h-12 w-12 rounded-xl bg-white text-slate-400 hover:text-rose-500 border border-slate-100 flex items-center justify-center transition-all"
                        aria-label="Remover veiculo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-primary/20 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Building2 className="w-5 h-5" />
                    <span>Criar Conta e Agendar</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-4 text-sm font-medium">
              {error}
            </div>
          )}
        </motion.main>
      </div>
    </div>
  );
}
