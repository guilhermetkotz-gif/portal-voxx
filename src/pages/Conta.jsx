import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  User, 
  Building2, 
  Bell, 
  Shield, 
  CheckCircle,
  Users,
  Mail,
  Phone,
  Upload,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const tipoAcessoLabels = {
  cliente_admin: { label: 'Administrador', color: 'bg-violet-100 text-violet-700' },
  cliente_viewer: { label: 'Visualizador', color: 'bg-slate-100 text-slate-700' },
  voxx_admin: { label: 'Voxx Admin', color: 'bg-emerald-100 text-emerald-700' },
  voxx_operacao: { label: 'Voxx Operação', color: 'bg-blue-100 text-blue-700' }
};

export default function Conta() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const [formData, setFormData] = useState({
    cargo: '',
    telefone: '',
    notificacoes_email: true,
    notificacoes_whatsapp: false
  });

  // Initialize form when user loads
  React.useEffect(() => {
    if (user) {
      setFormData({
        cargo: user.cargo || '',
        telefone: user.telefone || '',
        notificacoes_email: user.notificacoes_email !== false,
        notificacoes_whatsapp: user.notificacoes_whatsapp || false
      });
    }
  }, [user]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', user?.cliente_id],
    queryFn: () => base44.entities.Cliente.filter({ id: user?.cliente_id }),
    enabled: !!user?.cliente_id,
    staleTime: 60 * 1000
  });

  const cliente = clientes[0];

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teamMembers', user?.cliente_id],
    queryFn: async () => {
      if (user?.tipo_acesso !== 'cliente_admin') return [];
      const users = await base44.entities.User.list();
      return users.filter(u => u.cliente_id === user.cliente_id);
    },
    enabled: !!user?.cliente_id && user?.tipo_acesso === 'cliente_admin',
    staleTime: 60 * 1000
  });

  const updateProfile = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Perfil atualizado com sucesso!');
    }
  });

  const handleSave = async () => {
    setSaving(true);
    await updateProfile.mutateAsync(formData);
    setSaving(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateProfile.mutateAsync({ profile_picture: file_url });
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      await updateProfile.mutateAsync({ profile_picture: null });
      toast.success('Foto removida com sucesso!');
    } catch (error) {
      toast.error('Erro ao remover foto');
    }
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const accessConfig = tipoAcessoLabels[user?.tipo_acesso] || tipoAcessoLabels.cliente_viewer;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Card */}
      <Card className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="relative group">
            {user?.profile_picture ? (
              <img 
                src={user.profile_picture} 
                alt={user.full_name}
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
                <Upload className="w-5 h-5 text-white hover:scale-110 transition-transform" />
              </label>
              {user?.profile_picture && (
                <button onClick={handleRemovePhoto} disabled={uploadingPhoto}>
                  <X className="w-5 h-5 text-white hover:scale-110 transition-transform" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{user?.full_name}</h2>
            <p className="text-slate-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={accessConfig.color}>{accessConfig.label}</Badge>
              {user?.role === 'admin' && (
                <Badge className="bg-amber-100 text-amber-700">Admin do App</Badge>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Dados da Empresa */}
        {cliente && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Dados da Empresa</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500">Nome</p>
                <p className="font-medium text-slate-900">{cliente.nome}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tipo</p>
                <p className="font-medium text-slate-900 capitalize">{cliente.tipo_cliente || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dados Pessoais */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Dados Pessoais</h3>
          </div>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={user?.full_name || ''} disabled className="bg-slate-50" />
                <p className="text-xs text-slate-400">Não editável</p>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-slate-50" />
                <p className="text-xs text-slate-400">Não editável</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input 
                  value={formData.cargo}
                  onChange={(e) => setFormData({...formData, cargo: e.target.value})}
                  placeholder="Ex: Gestor, CRC, Coordenador..."
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input 
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notificações */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Notificações</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Notificações por Email</p>
                  <p className="text-sm text-slate-500">Receba atualizações de demandas e alertas</p>
                </div>
              </div>
              <Switch 
                checked={formData.notificacoes_email}
                onCheckedChange={(v) => setFormData({...formData, notificacoes_email: v})}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Notificações por WhatsApp</p>
                  <p className="text-sm text-slate-500">Alertas importantes no seu celular</p>
                </div>
              </div>
              <Switch 
                checked={formData.notificacoes_whatsapp}
                onCheckedChange={(v) => setFormData({...formData, notificacoes_whatsapp: v})}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Salvar Alterações
            </>
          )}
        </Button>
      </Card>

      {/* Team Members (only for admin) */}
      {user?.tipo_acesso === 'cliente_admin' && teamMembers.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Usuários da Conta</h3>
          </div>
          <div className="space-y-3">
            {teamMembers.map(member => {
              const memberAccess = tipoAcessoLabels[member.tipo_acesso] || tipoAcessoLabels.cliente_viewer;
              return (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {member.profile_picture ? (
                      <img 
                        src={member.profile_picture} 
                        alt={member.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-semibold">
                        {member.full_name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{member.full_name}</p>
                      <p className="text-sm text-slate-500">{member.email}</p>
                    </div>
                  </div>
                  <Badge className={memberAccess.color}>{memberAccess.label}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Security Info */}
      <Card className="p-6 bg-slate-50">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-slate-900">Segurança</h3>
            <p className="text-sm text-slate-500 mt-1">
              Seus dados estão protegidos e você só tem acesso às informações da sua própria conta.
              Para alterar senha ou email, entre em contato com o suporte.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}