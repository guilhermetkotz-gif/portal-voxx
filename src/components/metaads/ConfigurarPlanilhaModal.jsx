import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfigurarPlanilhaModal({ open, onOpenChange, config = null, tipo }) {
  const queryClient = useQueryClient();
  const isEditing = !!config;

  const [formData, setFormData] = useState({
    nome_configuracao: '',
    tipo: tipo || 'monitoramento',
    planilha_url: '',
    spreadsheet_id: '',
    aba_ontem: '',
    aba_7dias: '',
    mapeamento_colunas: {
      account_name: 'Account Name',
      impressions: 'Impressions',
      clicks_all: 'Clicks (All)',
      amount_spent: 'Amount Spent',
      frequency: 'Frequency',
      cost_per_messaging: 'Cost per Messaging Conversations Started',
      messaging_conversations: 'Messaging Conversations Started',
      cost_per_new_messaging: 'Cost per New Messaging Connection',
      new_messaging_connections: 'New Messaging Connections',
      cost_per_unique_link: 'Cost per Unique Link Click',
      page_engagement: 'Page Engagement',
      page_likes: 'Page Likes',
      reach: 'Reach',
      cpc: 'CPC (Cost per Link Click)',
      custo_engajamento: 'Custo por Engajamento',
      leads_repetidos: 'Leads Repetidos',
      leads: 'leads',
      cadastros_whats: 'CADASTROS + WHATS',
      nota_gpt: 'Nota GPT',
      cpl_meta_ads: 'CPL META ADS'
    },
    ativo: true
  });

  useEffect(() => {
    if (open) {
      if (config) {
        setFormData({
          nome_configuracao: config.nome_configuracao || '',
          tipo: config.tipo || tipo || 'monitoramento',
          planilha_url: config.planilha_url || '',
          spreadsheet_id: config.spreadsheet_id || '',
          aba_ontem: config.aba_ontem || '',
          aba_7dias: config.aba_7dias || '',
          mapeamento_colunas: config.mapeamento_colunas || formData.mapeamento_colunas,
          ativo: config.ativo !== undefined ? config.ativo : true
        });
      } else {
        setFormData({
          nome_configuracao: tipo === 'radar' ? 'Configuração RADAR META' : 'Configuração Monitoramento',
          tipo: tipo || 'monitoramento',
          planilha_url: '',
          spreadsheet_id: '',
          aba_ontem: '',
          aba_7dias: '',
          mapeamento_colunas: {
            account_name: 'Account Name',
            impressions: 'Impressions',
            clicks_all: 'Clicks (All)',
            amount_spent: 'Amount Spent',
            frequency: 'Frequency',
            cost_per_messaging: 'Cost per Messaging Conversations Started',
            messaging_conversations: 'Messaging Conversations Started',
            cost_per_new_messaging: 'Cost per New Messaging Connection',
            new_messaging_connections: 'New Messaging Connections',
            cost_per_unique_link: 'Cost per Unique Link Click',
            page_engagement: 'Page Engagement',
            page_likes: 'Page Likes',
            reach: 'Reach',
            cpc: 'CPC (Cost per Link Click)',
            custo_engajamento: 'Custo por Engajamento',
            leads_repetidos: 'Leads Repetidos',
            leads: 'leads',
            cadastros_whats: 'CADASTROS + WHATS',
            nota_gpt: 'Nota GPT',
            cpl_meta_ads: 'CPL META ADS'
          },
          ativo: true
        });
      }
    }
  }, [open, config, tipo]);

  const extractSpreadsheetId = (url) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : '';
  };

  const handleUrlChange = (url) => {
    setFormData(prev => ({
      ...prev,
      planilha_url: url,
      spreadsheet_id: extractSpreadsheetId(url)
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (isEditing) {
        return base44.entities.MetaAdsSheetConfig.update(config.id, data);
      } else {
        return base44.entities.MetaAdsSheetConfig.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metaAdsSheetConfigs'] });
      toast.success(isEditing ? 'Configuração atualizada!' : 'Configuração criada!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.spreadsheet_id) {
      toast.error('URL da planilha inválida');
      return;
    }

    if (!formData.aba_ontem) {
      toast.error('Nome da aba de ontem é obrigatório');
      return;
    }

    if (formData.tipo === 'radar' && !formData.aba_7dias) {
      toast.error('Para configuração RADAR, a aba de 7 dias é obrigatória');
      return;
    }

    saveMutation.mutate(formData);
  };

  const updateColuna = (campo, valor) => {
    setFormData(prev => ({
      ...prev,
      mapeamento_colunas: {
        ...prev.mapeamento_colunas,
        [campo]: valor
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Configuração de Planilha' : 'Nova Configuração de Planilha'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info Básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome da Configuração</Label>
                <Input
                  value={formData.nome_configuracao}
                  onChange={(e) => setFormData({ ...formData, nome_configuracao: e.target.value })}
                  placeholder="Ex: Radar Meta - Principal"
                  required
                />
              </div>

              <div>
                <Label>URL da Planilha Google Sheets</Label>
                <Input
                  value={formData.planilha_url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  required
                />
                {formData.spreadsheet_id && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ ID extraído: {formData.spreadsheet_id}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome da Aba (Dados de Ontem)</Label>
                  <Input
                    value={formData.aba_ontem}
                    onChange={(e) => setFormData({ ...formData, aba_ontem: e.target.value })}
                    placeholder="Ex: ontem meta ads"
                    required
                  />
                </div>

                {formData.tipo === 'radar' && (
                  <div>
                    <Label>Nome da Aba (Dados de 7 Dias)</Label>
                    <Input
                      value={formData.aba_7dias}
                      onChange={(e) => setFormData({ ...formData, aba_7dias: e.target.value })}
                      placeholder="Ex: 7 dias Meta Ads"
                      required={formData.tipo === 'radar'}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mapeamento de Colunas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mapeamento de Colunas</CardTitle>
              <p className="text-sm text-slate-500">
                Informe o nome exato de cada coluna na planilha
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="basico" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basico">Básico</TabsTrigger>
                  <TabsTrigger value="metricas">Métricas</TabsTrigger>
                  <TabsTrigger value="custos">Custos</TabsTrigger>
                </TabsList>

                <TabsContent value="basico" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Account Name</Label>
                      <Input
                        value={formData.mapeamento_colunas.account_name}
                        onChange={(e) => updateColuna('account_name', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Impressions</Label>
                      <Input
                        value={formData.mapeamento_colunas.impressions}
                        onChange={(e) => updateColuna('impressions', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Clicks (All)</Label>
                      <Input
                        value={formData.mapeamento_colunas.clicks_all}
                        onChange={(e) => updateColuna('clicks_all', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Amount Spent</Label>
                      <Input
                        value={formData.mapeamento_colunas.amount_spent}
                        onChange={(e) => updateColuna('amount_spent', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Frequency</Label>
                      <Input
                        value={formData.mapeamento_colunas.frequency}
                        onChange={(e) => updateColuna('frequency', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Reach</Label>
                      <Input
                        value={formData.mapeamento_colunas.reach}
                        onChange={(e) => updateColuna('reach', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="metricas" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Messaging Conversations Started</Label>
                      <Input
                        value={formData.mapeamento_colunas.messaging_conversations}
                        onChange={(e) => updateColuna('messaging_conversations', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">New Messaging Connections</Label>
                      <Input
                        value={formData.mapeamento_colunas.new_messaging_connections}
                        onChange={(e) => updateColuna('new_messaging_connections', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Page Engagement</Label>
                      <Input
                        value={formData.mapeamento_colunas.page_engagement}
                        onChange={(e) => updateColuna('page_engagement', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Page Likes</Label>
                      <Input
                        value={formData.mapeamento_colunas.page_likes}
                        onChange={(e) => updateColuna('page_likes', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Leads Repetidos %</Label>
                      <Input
                        value={formData.mapeamento_colunas.leads_repetidos}
                        onChange={(e) => updateColuna('leads_repetidos', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Leads (CADASTROS)</Label>
                      <Input
                        value={formData.mapeamento_colunas.leads || ''}
                        onChange={(e) => updateColuna('leads', e.target.value)}
                        className="text-sm"
                        placeholder="leads"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CADASTROS + WHATS</Label>
                      <Input
                        value={formData.mapeamento_colunas.cadastros_whats || ''}
                        onChange={(e) => updateColuna('cadastros_whats', e.target.value)}
                        className="text-sm"
                        placeholder="CADASTROS + WHATS"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nota GPT</Label>
                      <Input
                        value={formData.mapeamento_colunas.nota_gpt}
                        onChange={(e) => updateColuna('nota_gpt', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="custos" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Cost per Messaging Conversations</Label>
                      <Input
                        value={formData.mapeamento_colunas.cost_per_messaging}
                        onChange={(e) => updateColuna('cost_per_messaging', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cost per New Messaging Connection</Label>
                      <Input
                        value={formData.mapeamento_colunas.cost_per_new_messaging}
                        onChange={(e) => updateColuna('cost_per_new_messaging', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cost per Unique Link Click</Label>
                      <Input
                        value={formData.mapeamento_colunas.cost_per_unique_link}
                        onChange={(e) => updateColuna('cost_per_unique_link', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CPC (Cost Per Link Click)</Label>
                      <Input
                        value={formData.mapeamento_colunas.cpc}
                        onChange={(e) => updateColuna('cpc', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Custo por Engajamento</Label>
                      <Input
                        value={formData.mapeamento_colunas.custo_engajamento}
                        onChange={(e) => updateColuna('custo_engajamento', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CPL META ADS (Custo/Conversa — col. R)</Label>
                      <Input
                        value={formData.mapeamento_colunas.cpl_meta_ads || ''}
                        onChange={(e) => updateColuna('cpl_meta_ads', e.target.value)}
                        className="text-sm"
                        placeholder="CPL META ADS"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-900">
                    <p className="font-medium mb-1">Dica:</p>
                    <p>Os nomes das colunas devem corresponder EXATAMENTE aos cabeçalhos da planilha Google Sheets. Maiúsculas e minúsculas não importam, mas o texto deve ser igual.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={saveMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Salvar Alterações' : 'Criar Configuração'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}