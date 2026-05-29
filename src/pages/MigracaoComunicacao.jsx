import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertTriangle, MessageCircle, ShieldAlert } from 'lucide-react';

export default function MigracaoComunicacao({ user }) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <Card className="max-w-lg mx-auto p-8 text-center mt-10">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Acesso restrito</h2>
        <p className="text-sm text-slate-500 mt-1">Apenas administradores podem executar migrações.</p>
      </Card>
    );
  }

  const handleMigrar = async () => {
    setLoading(true);
    setErro(null);
    setResultado(null);
    const res = await base44.functions.invoke('migrarComunicacaoDemandas', {});
    if (res.data?.success) {
      setResultado(res.data.log);
    } else {
      setErro(res.data?.error || 'Erro desconhecido.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Migração — Comunicação com Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Atenção antes de executar
            </p>
            <ul className="text-sm text-amber-700 list-disc list-inside space-y-0.5">
              <li>Define <code className="bg-amber-100 px-1 rounded">comunicar_cliente = true</code> em todas as demandas ativas</li>
              <li>Não alimenta a FilaComunicacaoCliente (sem eventos retroativos)</li>
              <li>Não altera demandas concluídas, finalizadas ou canceladas</li>
              <li>Não altera demandas que já possuem <code className="bg-amber-100 px-1 rounded">comunicar_cliente = true</code></li>
              <li>A operação é segura e reversível manualmente por demanda</li>
            </ul>
          </div>

          <Button
            onClick={handleMigrar}
            disabled={loading || !!resultado}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando migração...</>
            ) : resultado ? (
              <><CheckCircle className="w-4 h-4 mr-2" /> Migração concluída</>
            ) : (
              'Executar Migração'
            )}
          </Button>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 font-medium">Erro: {erro}</p>
            </div>
          )}

          {resultado && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-green-800">Migração executada com sucesso</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-200 text-center">
                  <p className="text-2xl font-bold text-green-700">{resultado.demandas_atualizadas}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Demandas atualizadas</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200 text-center">
                  <p className="text-2xl font-bold text-slate-600">{resultado.demandas_ja_configuradas}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Já estavam configuradas</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-slate-600"><span className="font-medium">Executado por:</span> {resultado.executado_por_nome} ({resultado.executado_por})</p>
                <p className="text-slate-600"><span className="font-medium">Data:</span> {new Date(resultado.data_migracao).toLocaleString('pt-BR')}</p>
                {resultado.erros > 0 && (
                  <p className="text-red-600"><span className="font-medium">Erros:</span> {resultado.erros} demanda(s) não atualizadas</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}