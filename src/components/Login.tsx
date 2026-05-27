import React, { useState } from 'react';
import { motion } from '../lib/motion';
import {
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  KeyRound,
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
import { api, ClientSignupPayload } from '../services/api';

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
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
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

  const openForgotPassword = () => {
    setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
    setForgotMessage(null);
    setError(null);
    setIsForgotOpen(true);
  };

  const handleForgotSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!forgotEmail.trim()) {
      setForgotMessage(null);
      setError('Informe o email cadastrado.');
      return;
    }

    setIsSendingForgot(true);
    setError(null);
    setForgotMessage(null);
    try {
      const response = await api.forgotPassword(forgotEmail.trim());
      setForgotMessage(response.message || 'Se este email estiver cadastrado, enviaremos uma senha temporaria.');
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel solicitar a senha temporaria.');
    } finally {
      setIsSendingForgot(false);
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
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-2xl shadow-slate-200/70 grid lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="hidden lg:flex flex-col justify-between border-r border-amber-100 bg-amber-50/70 text-slate-900 p-10">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={getSafeLogoSrc()}
                alt="Norte Tech Logo"
                className="w-12 h-12 object-contain"
                referrerPolicy="no-referrer"
              />
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Norte <span className="text-amber-600">Tech</span>
              </h1>
            </div>

            <div className="mt-14 space-y-5">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-amber-700">Acesso do cliente</p>
              <h2 className="text-4xl font-black leading-tight tracking-tight">
                Login e cadastro direto para agendar lavagens.
              </h2>
              <p className="text-base font-medium leading-7 text-slate-600">
                O cliente entra, cadastra seus veiculos e ja acessa a agenda da base liberada.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-bold text-slate-700">Permissao automatica como Clientes</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
              <Car className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-bold text-slate-700">Veiculos vinculados ao cadastro</span>
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
              Norte <span className="text-amber-500">Tech</span>
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
            <>
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
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700"
                  >
                    Esqueceu senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group w-fit">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all" />
                  <CheckCircle2 className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Manter conectado</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-amber-500/20 disabled:opacity-70"
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
            {isForgotOpen && (
              <form onSubmit={handleForgotSubmit} className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900">Receber senha temporaria</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-600">
                      Enviaremos uma senha temporaria para o email cadastrado, se ele existir no sistema.
                    </p>
                  </div>
                </div>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder="cliente@empresa.com"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-amber-500"
                />
                {forgotMessage && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    {forgotMessage}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="flex-1 rounded-xl border border-amber-100 bg-white px-3 py-3 text-xs font-black uppercase tracking-widest text-slate-600"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingForgot}
                    className="flex-1 rounded-xl bg-amber-500 px-3 py-3 text-xs font-black uppercase tracking-widest text-slate-950 disabled:opacity-70"
                  >
                    {isSendingForgot ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            )}
            </>
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all"
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all"
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all"
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all"
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
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all appearance-none"
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
                    className="h-10 px-3 rounded-xl border border-amber-200 bg-white text-amber-700 font-black text-xs flex items-center gap-2 active:scale-[0.98] transition-all hover:bg-amber-50"
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
                          className="w-full h-12 bg-white border border-slate-100 rounded-xl pl-10 pr-3 font-black uppercase text-slate-900 focus:border-amber-500 outline-none"
                        />
                      </div>

                      <input
                        type="text"
                        required
                        value={vehicle.model}
                        onChange={(event) => updateClientVehicle(index, { model: event.target.value })}
                        placeholder="Modelo"
                        className="w-full h-12 bg-white border border-slate-100 rounded-xl px-3 font-bold text-slate-900 focus:border-amber-500 outline-none"
                      />

                      <select
                        value={vehicle.type}
                        onChange={(event) => updateClientVehicle(index, { type: event.target.value as VehicleType })}
                        className="w-full h-12 bg-white border border-slate-100 rounded-xl px-3 font-bold text-slate-900 focus:border-amber-500 outline-none appearance-none"
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
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-amber-500/20 disabled:opacity-70"
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
