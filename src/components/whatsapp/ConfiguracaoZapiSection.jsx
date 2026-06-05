import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save, Eye, EyeOff, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoZapiSection() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState({
    instance_id: '',
    token_instancia: '',
    token_global: '',
    webhook_url_receber: ''
  });
  const [configId, setConfigId] = useState(null);
  const [showToken, setShowToken] = useState({ token_instancia: false, token_global: false });
  const [copied, setCopied] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['configuracaoZapi'],
    queryFn: () => base44.entities.ConfiguracaoZapi.list('-created_date', 1),
    onSuccess: (data) => {
      if (data?.[0]) {
        const c = data[0];
        setConfigId(c.id);
        setConfig({
          instance_id: c.instance_id || '',
          token_instancia: c.token_instancia || '',
          token_global: c.token_global || '',
          webhook_url_receber: c.webhook_url_receber || ''
        });
      }
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (configId) {
        return base44.entities.ConfiguracaoZapi.update(configId, config);
      }
      return base44.entities.ConfiguracaoZapi.create(config);
    },
    onSuccess: (data) => {
      if (!configId && data?.id) setConfigId(data.id);
      queryClient.invalidateQueries({ queryKey: ['configuracaoZapi'] });
      toast.success('Configuração Z-API salva com sucesso!');
    },
    onError: (e) => toast.error('Erro ao salvar: ' + e.message)
  });

  const toggleShow = (field) => setShowToken(p => ({ ...p, [field]: !p[field] }));

  const handleCopy = (value) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return (
    <Card className="p-6 flex items-center gap-3">
      <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
      <span className="text-sm text-slate-500">Carregando configurações...</span>
    </Card>
  );

  return (
    <Card className="border-violet-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="p-1.5 bg-violet-100 rounded-lg">
            <Settings className="w-4 h-4 text-violet-600" />
          </div>
          Credenciais Z-API
        </CardTitle>
        <p className="text-xs text-slate-500">
          Configure as credenciais da sua instância Z-API. Os dados são salvos de forma segura.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Instance ID */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">ID da Instância</Label>
            <Input
              placeholder="Ex: 3AB12C4D5E6F..."
              value={config.instance_id}
              onChange={e => setConfig(p => ({ ...p, instance_id: e.target.value }))}
              className="h-9 text-sm font-mono"
            />
            <p className="text-xs text-slate-400">Encontrado no painel Z-API</p>
          </div>

          {/* Token Instância */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Token da Instância</Label>
            <div className="relative">
              <Input
                type={showToken.token_instancia ? 'text' : 'password'}
                placeholder="Token da instância"
                value={config.token_instancia}
                onChange={e => setConfig(p => ({ ...p, token_instancia: e.target.value }))}
                className="h-9 text-sm font-mono pr-9"
              />
              <button
                type="button"
                onClick={() => toggleShow('token_instancia')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showToken.token_instancia ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">Token específico da instância</p>
          </div>

          {/* Token Global */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Token Global (Client-Token)</Label>
            <div className="relative">
              <Input
                type={showToken.token_global ? 'text' : 'password'}
                placeholder="Client-Token Z-API"
                value={config.token_global}
                onChange={e => setConfig(p => ({ ...p, token_global: e.target.value }))}
                className="h-9 text-sm font-mono pr-9"
              />
              <button
                type="button"
                onClick={() => toggleShow('token_global')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showToken.token_global ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">Token global do painel Z-API</p>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Webhook — URL ao Receber Mensagens</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://... (URL da função webhookZapiReceber no Base44)"
              value={config.webhook_url_receber}
              onChange={e => setConfig(p => ({ ...p, webhook_url_receber: e.target.value }))}
              className="h-9 text-sm font-mono flex-1"
            />
            {config.webhook_url_receber && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-3 gap-1 shrink-0"
                onClick={() => handleCopy(config.webhook_url_receber)}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
          <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Para obter a URL do webhook, acesse{' '}
              <strong className="text-slate-700">Base44 Dashboard → Código → Funções → webhookZapiReceber</strong>{' '}
              e copie a URL exibida. Configure essa URL no painel Z-API em{' '}
              <strong className="text-slate-700">Instância → Webhooks → Ao Receber</strong>.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1 border-t border-slate-100">
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!config.instance_id || saveMutation.isPending}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700"
          >
            {saveMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Save className="w-3.5 h-3.5" />
            }
            Salvar Configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}