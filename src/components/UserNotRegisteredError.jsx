import React from 'react';
import { base44 } from '@/api/base44Client';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-lg border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-violet-100">
          <svg className="w-8 h-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">Acesso não autorizado</h1>
        <p className="text-slate-500 mb-6">
          Sua conta ainda não tem acesso ao <strong>Portal Voxx</strong>. 
          Entre em contato com a equipe Voxx para solicitar seu acesso.
        </p>

        <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600 mb-6 text-left">
          <p className="font-medium text-slate-700 mb-2">O que fazer:</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-violet-500 font-bold mt-0.5">•</span>
              Verifique se está logado com o e-mail correto
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500 font-bold mt-0.5">•</span>
              Solicite acesso à equipe Voxx
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500 font-bold mt-0.5">•</span>
              Aguarde o convite por e-mail antes de tentar acessar
            </li>
          </ul>
        </div>

        <button
          onClick={() => base44.auth.logout('/')}
          className="w-full py-2.5 px-4 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
        >
          Sair e tentar com outra conta
        </button>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;