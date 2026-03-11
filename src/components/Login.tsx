import React, { useState } from 'react';
import { motion } from '../lib/motion';
import { Lock, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { validateStrongPassword } from '../utils/app';

interface LoginProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
}

export default function Login({ onLogin }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordError = password ? validateStrongPassword(password) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordError) {
      return;
    }

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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] flex flex-col justify-center px-8 sm:px-12 py-12 relative z-10 bg-white rounded-3xl shadow-2xl shadow-slate-200/50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm mx-auto"
        >
          <div className="flex items-center gap-3 mb-12">
            <img
              src="https://teslaeventos.com.br/assets/logos/NORTETECH-CIRCLE.png"
              alt="Norte Tech Logo"
              className="w-12 h-12 object-contain"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Norte <span className="text-primary">Tech</span>
            </h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Bem-vindo de volta</h2>
            <p className="text-slate-500 font-medium">Acesse o sistema para gerenciar sua estetica automotiva.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="1001 ou cliente@empresa.com"
                  autoComplete="username"
                  inputMode="text"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Senha</label>
                <button type="button" className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                  Esqueceu?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
              <p className={`text-[10px] font-bold ml-1 ${passwordError ? 'text-rose-500' : 'text-slate-400'}`}>
                {passwordError || 'Use 12+ caracteres com maiuscula, minuscula, numero e simbolo.'}
              </p>
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
              disabled={isLoading || !!passwordError}
              className="w-full bg-primary hover:bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-primary/20 disabled:opacity-70 mt-8"
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

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-4 text-sm font-medium">
                {error}
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
