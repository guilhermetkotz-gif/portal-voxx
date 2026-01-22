import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Mail, Smartphone, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ConfiguracaoAlertas({ user }) {
  const queryClient = useQueryClient();
  
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notificationPreferences', user?.id],
    queryFn: async () => {
      const prefs = await base44.entities.NotificationPreference.filter({
        usuario_id: user.id
      });
      
      if (prefs.length > 0) {
        return prefs[0];
      }
      
      // Return defaults if no preferences exist
      return {
        saldo_baixo_enabled: true,
        saldo_baixo_dias: 3,
        tomada_vencimento_enabled: true,
        tomada_vencimento_dias: 2,
        gasto_excedido_enabled: true,
        gasto_excedido_percentual: 120,
        enviar_email: true,
        enviar_inapp: true,
        frequencia_email: 'diario'
      };
    },
    enabled: !!user
  });
  
  const [formData, setFormData] = useState({});
  
  React.useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);
  
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        usuario_id: user.id,
        usuario_email: user.email,
        ...data
      };
      
      if (preferences?.id) {
        return base44.entities.NotificationPreference.update(preferences.id, payload);
      } else {
        return base44.entities.NotificationPreference.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificationPreferences']);
      toast.success('Preferências salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar preferências: ' + error.message);
    }
  });
  
  const handleSave = () => {
    saveMutation.mutate(formData);
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  if (isLoading) {
    return <div className="p-8">Carregando...</div>;
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuração de Alertas</h1>
          <p className="text-slate-600 mt-1">Personalize como você recebe notificações proativas</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Preferências
        </Button>
      </div>
      
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          O sistema verifica automaticamente todos os dias e envia alertas baseados nas suas configurações.
        </AlertDescription>
      </Alert>
      
      {/* Canais de Notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Canais de Notificação
          </CardTitle>
          <CardDescription>Escolha onde deseja receber seus alertas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Notificações In-App
              </Label>
              <p className="text-sm text-slate-500">Receba alertas dentro do sistema</p>
            </div>
            <Switch
              checked={formData.enviar_inapp}
              onCheckedChange={(checked) => handleChange('enviar_inapp', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Notificações por Email
              </Label>
              <p className="text-sm text-slate-500">Receba alertas no email: {user?.email}</p>
            </div>
            <Switch
              checked={formData.enviar_email}
              onCheckedChange={(checked) => handleChange('enviar_email', checked)}
            />
          </div>
          
          {formData.enviar_email && (
            <div className="pl-6 space-y-2">
              <Label>Frequência de Emails</Label>
              <Select
                value={formData.frequencia_email}
                onValueChange={(value) => handleChange('frequencia_email', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imediato">Imediato (assim que detectado)</SelectItem>
                  <SelectItem value="diario">Resumo Diário</SelectItem>
                  <SelectItem value="semanal">Resumo Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Alerta 1: Saldo Baixo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>💰 Saldo Criticamente Baixo</CardTitle>
              <CardDescription>Alerta quando o saldo não durar muitos dias</CardDescription>
            </div>
            <Switch
              checked={formData.saldo_baixo_enabled}
              onCheckedChange={(checked) => handleChange('saldo_baixo_enabled', checked)}
            />
          </div>
        </CardHeader>
        {formData.saldo_baixo_enabled && (
          <CardContent>
            <div className="space-y-2">
              <Label>Alertar quando o saldo durar menos de (dias)</Label>
              <Input
                type="number"
                value={formData.saldo_baixo_dias || 3}
                onChange={(e) => handleChange('saldo_baixo_dias', parseInt(e.target.value))}
                min="1"
                max="30"
              />
              <p className="text-sm text-slate-500">
                Exemplo: Se configurar 3 dias, você será alertado quando o saldo atual durar menos de 3 dias baseado no gasto diário.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Alerta 2: Tomada Vencimento */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>📅 Tomada Próxima do Vencimento</CardTitle>
              <CardDescription>Alerta quando uma tomada está próxima da data de envio/vencimento</CardDescription>
            </div>
            <Switch
              checked={formData.tomada_vencimento_enabled}
              onCheckedChange={(checked) => handleChange('tomada_vencimento_enabled', checked)}
            />
          </div>
        </CardHeader>
        {formData.tomada_vencimento_enabled && (
          <CardContent>
            <div className="space-y-2">
              <Label>Alertar com quantos dias de antecedência</Label>
              <Input
                type="number"
                value={formData.tomada_vencimento_dias || 2}
                onChange={(e) => handleChange('tomada_vencimento_dias', parseInt(e.target.value))}
                min="0"
                max="15"
              />
              <p className="text-sm text-slate-500">
                Exemplo: Se configurar 2 dias, você será alertado quando faltarem 2 dias ou menos para a data de envio da tomada.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Alerta 3: Gasto Excedido */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>📊 Gasto Diário Excedido</CardTitle>
              <CardDescription>Alerta quando o gasto diário exceder o planejado</CardDescription>
            </div>
            <Switch
              checked={formData.gasto_excedido_enabled}
              onCheckedChange={(checked) => handleChange('gasto_excedido_enabled', checked)}
            />
          </div>
        </CardHeader>
        {formData.gasto_excedido_enabled && (
          <CardContent>
            <div className="space-y-2">
              <Label>Alertar quando exceder (%)</Label>
              <Input
                type="number"
                value={formData.gasto_excedido_percentual || 120}
                onChange={(e) => handleChange('gasto_excedido_percentual', parseInt(e.target.value))}
                min="100"
                max="300"
              />
              <p className="text-sm text-slate-500">
                Exemplo: Se configurar 120%, você será alertado quando o gasto diário atingir 120% do valor planejado por dia.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}