import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function CrcConfiguracao({ currentCliente, user }) {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['crcConfig', currentCliente?.id],
    queryFn: async () => {
      const configs = await base44.entities.CrcConfig.filter({ 
        unidade_id: currentCliente?.id 
      });
      return configs[0];
    },
    enabled: !!currentCliente?.id
  });

  const [formData, setFormData] = useState({
    sla_primeira_tentativa_min: 30,
    max_tentativas_recomendado: 6,
    mapeamento_planilha: {
      coluna_nome: 'Nome',
      coluna_telefone: 'Telefone',
      coluna_data: 'Data',
      coluna_origem: 'Tipo',
      coluna_campanha: '',
      coluna_link_anuncio: '',
      coluna_observacao: ''
    }
  });

  React.useEffect(() => {
    if (config) {
      setFormData({
        sla_primeira_tentativa_min: config.sla_primeira_tentativa_min || 30,
        max_tentativas_recomendado: config.max_tentativas_recomendado || 6,
        mapeamento_planilha: config.mapeamento_planilha || formData.mapeamento_planilha
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (config) {
        return base44.entities.CrcConfig.update(config.id, data);
      } else {
        return base44.entities.CrcConfig.create({
          ...data,
          unidade_id: currentCliente.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['crcConfig']);
      toast.success('Configurações salvas com sucesso!');
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      // First save config if needed
      if (!config) {
        await base44.entities.CrcConfig.create({
          ...formData,
          unidade_id: currentCliente.id
        });
      }
      
      // Then sync leads
      const response = await base44.functions.invoke('syncCrcLeadsFromGoogle', { 
        clienteId: currentCliente.id 
      });
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries(['crcLeads']);
      queryClient.invalidateQueries(['crcConfig']);
      const data = response.data;
      toast.success(data.message || `${data.totalImported || data.imported || 0} leads importados`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.message || 'Erro ao sincronizar leads');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleSync = async () => {
    if (!currentCliente?.google_leads_sheet_url) {
      toast.error('Configure a URL da planilha Google no cadastro do cliente');
      return;
    }
    
    // Save config first if needed
    if (!config) {
      try {
        await base44.entities.CrcConfig.create({
          ...formData,
          unidade_id: currentCliente.id
        });
        await queryClient.invalidateQueries(['crcConfig']);
      } catch (error) {
        toast.error('Erro ao salvar configuração: ' + error.message);
        return;
      }
    }
    
    syncMutation.mutate();
  };

  if (!currentCliente) {
    return <div className="text-center py-12 text-slate-500">Selecione uma unidade</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Configuração CRC</h2>
          <p className="text-sm text-slate-600 mt-1">
            Personalize regras de SLA e mapeamento de planilha
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>

      <Tabs defaultValue="sla">
        <TabsList>
          <TabsTrigger value="sla">SLA e Cadência</TabsTrigger>
          <TabsTrigger value="mapeamento">Mapeamento Planilha Google</TabsTrigger>
        </TabsList>

        <TabsContent value="sla" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Regras de SLA</h3>
            <div className="space-y-4 max-w-xl">
              <div>
                <Label>SLA Primeira Tentativa (minutos)</Label>
                <Input
                  type="number"
                  value={formData.sla_primeira_tentativa_min}
                  onChange={(e) => setFormData({
                    ...formData,
                    sla_primeira_tentativa_min: parseInt(e.target.value)
                  })}
                  placeholder="30"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Tempo máximo para primeira tentativa antes do lead ficar atrasado
                </p>
              </div>

              <div>
                <Label>Máximo de Tentativas Recomendado</Label>
                <Input
                  type="number"
                  value={formData.max_tentativas_recomendado}
                  onChange={(e) => setFormData({
                    ...formData,
                    max_tentativas_recomendado: parseInt(e.target.value)
                  })}
                  placeholder="6"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Número de tentativas antes de marcar lead como crítico
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="mapeamento" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Mapeamento de Colunas</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Configure os nomes das colunas na planilha Google
                </p>
              </div>
              <Button 
                onClick={handleSync} 
                disabled={syncMutation.isPending || !currentCliente?.google_leads_sheet_url}
              >
                {syncMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <RefreshCw className="w-4 h-4 mr-2" />
                Sincronizar Agora
              </Button>
            </div>

            {!currentCliente?.google_leads_sheet_url && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">
                  ⚠️ Configure a URL da planilha Google no cadastro do cliente antes de sincronizar.
                </p>
              </div>
            )}

            <div className="space-y-4 max-w-xl">
              <div>
                <Label>Coluna de Nome *</Label>
                <Input
                  value={formData.mapeamento_planilha.coluna_nome}
                  onChange={(e) => setFormData({
                    ...formData,
                    mapeamento_planilha: {
                      ...formData.mapeamento_planilha,
                      coluna_nome: e.target.value
                    }
                  })}
                  placeholder="Nome"
                />
              </div>

              <div>
                <Label>Coluna de Telefone *</Label>
                <Input
                  value={formData.mapeamento_planilha.coluna_telefone}
                  onChange={(e) => setFormData({
                    ...formData,
                    mapeamento_planilha: {
                      ...formData.mapeamento_planilha,
                      coluna_telefone: e.target.value
                    }
                  })}
                  placeholder="Telefone"
                />
              </div>

              <div>
                <Label>Coluna de Data</Label>
                <Input
                  value={formData.mapeamento_planilha.coluna_data}
                  onChange={(e) => setFormData({
                    ...formData,
                    mapeamento_planilha: {
                      ...formData.mapeamento_planilha,
                      coluna_data: e.target.value
                    }
                  })}
                  placeholder="Data"
                />
              </div>

              <div>
                <Label>Coluna de Tipo/Origem</Label>
                <Input
                  value={formData.mapeamento_planilha.coluna_origem}
                  onChange={(e) => setFormData({
                    ...formData,
                    mapeamento_planilha: {
                      ...formData.mapeamento_planilha,
                      coluna_origem: e.target.value
                    }
                  })}
                  placeholder="Tipo"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Ex: "Cadastro" ou "Ligação"
                </p>
              </div>

              <div>
                <Label>Coluna de Link do Anúncio (opcional)</Label>
                <Input
                  value={formData.mapeamento_planilha.coluna_link_anuncio}
                  onChange={(e) => setFormData({
                    ...formData,
                    mapeamento_planilha: {
                      ...formData.mapeamento_planilha,
                      coluna_link_anuncio: e.target.value
                    }
                  })}
                  placeholder="Link"
                />
              </div>

              <div>
                <Label>Coluna de Observação (opcional)</Label>
                <Input
                  value={formData.mapeamento_planilha.coluna_observacao}
                  onChange={(e) => setFormData({
                    ...formData,
                    mapeamento_planilha: {
                      ...formData.mapeamento_planilha,
                      coluna_observacao: e.target.value
                    }
                  })}
                  placeholder="Observação"
                />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}