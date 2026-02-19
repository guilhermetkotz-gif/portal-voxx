import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, 
  BarChart3,
  FileText,
  Wallet,
  Zap,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BoasVindas({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState('boas-vindas'); // 'boas-vindas' | 'cadastro' | 'obrigado'

  // Se usuário já está ativo, redirecionar para Home
  React.useEffect(() => {
    if (user && user.status === 'ativo') {
      navigate(createPageUrl('Home'));
    }
  }, [user, navigate]);
  
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState('cliente_usuario');
  const [unidadesDesejadas, setUnidadesDesejadas] = useState('');
  const [funcao, setFuncao] = useState('');

  const criarSolicitacao = useMutation({
    mutationFn: async () => {
      // Call backend function to create user and request
      const response = await base44.functions.invoke('criarSolicitacaoAcesso', {
        nome,
        email,
        senha,
        tipoUsuario,
        funcao,
        unidadesDesejadas
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoesAcesso'] });
      setEtapa('obrigado');
      toast.success('Solicitação enviada com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao enviar solicitação. Tente novamente.');
      console.error('Erro completo:', error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!nome || !email || !senha || !funcao || !unidadesDesejadas.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (senha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    criarSolicitacao.mutate();
  };

  if (etapa === 'obrigado') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 text-center">
          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-violet-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Obrigado!</h1>
          <p className="text-lg text-slate-600 mb-8">
            Estamos configurando seu acesso, verifique a confirmação de cadastro no seu email por favor.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-700">
              📧 Um email de confirmação foi enviado para <strong>{email}</strong>
            </p>
          </div>

          <Button
            onClick={() => base44.auth.redirectToLogin()}
            className="bg-violet-600 hover:bg-violet-700"
          >
            Fazer Login
          </Button>
        </Card>
      </div>
    );
  }

  if (etapa === 'boas-vindas') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Logo e Título */}
          <div className="text-center mb-12">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695d14d862b9c933054dfba4/33a91785b_image.png" 
              alt="Voxx Logo" 
              className="w-32 h-32 mx-auto mb-6 object-contain"
            />
            <h1 className="text-4xl font-bold text-white mb-3">
              Bem-vindo ao Portal Voxx
            </h1>
            <p className="text-xl text-slate-300">
              Acompanhe performance, demandas e entregas da sua unidade em um só lugar.
            </p>
          </div>

          {/* O que você encontra aqui */}
          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            <Card className="p-6 hover:shadow-lg transition-shadow bg-slate-900 border-slate-800">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Performance de Campanhas</h3>
              <p className="text-sm text-slate-400">
                Acompanhe métricas de Meta e Google Ads em tempo real
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow bg-slate-900 border-slate-800">
              <div className="w-12 h-12 bg-violet-500/20 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Status de Demandas</h3>
              <p className="text-sm text-slate-400">
                Veja o andamento de todas as suas solicitações
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow bg-slate-900 border-slate-800">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Saldos e Investimentos</h3>
              <p className="text-sm text-slate-400">
                Controle financeiro e próximos investimentos
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow bg-slate-900 border-slate-800">
              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Transparência Total</h3>
              <p className="text-sm text-slate-400">
                Organização sem precisar cobrar no WhatsApp
              </p>
            </Card>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => setEtapa('cadastro')}
              className="bg-violet-600 hover:bg-violet-700 text-lg px-8 py-6 h-auto"
              size="lg"
            >
              Criar acesso ao Portal Voxx
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={() => base44.auth.redirectToLogin()}
              variant="outline"
              className="text-lg px-8 py-6 h-auto bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
              size="lg"
            >
              Já tenho acesso — Entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Etapa de Cadastro
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Solicitar Acesso</h1>
          <p className="text-slate-600">Preencha as informações para criar seu acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Dados Pessoais</h3>
            
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <div>
                <Label>Confirmar Senha *</Label>
                <Input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a senha"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Tipo de Usuário *</Label>
              <Select value={tipoUsuario} onValueChange={setTipoUsuario}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente_admin">Cliente Admin (gerencia usuários)</SelectItem>
                  <SelectItem value="cliente_usuario">Cliente Usuário (acesso padrão)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Qual sua função na unidade? *</Label>
              <Input
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                placeholder="Ex: Gestor, CRC, Coordenador de Marketing..."
                required
              />
            </div>
          </div>

          {/* Contas */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Unidades/Contas *</h3>
              <p className="text-sm text-slate-500">
                Informe as unidades ou contas que você precisa acessar. O administrador irá vincular seu acesso após análise da solicitação.
              </p>
            </div>

            <Textarea
              value={unidadesDesejadas}
              onChange={(e) => setUnidadesDesejadas(e.target.value)}
              placeholder="Ex: Clínica Oral Sin - São Paulo (Jardins), Clínica Oral Sin - Campinas..."
              className="min-h-[100px]"
              required
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEtapa('boas-vindas')}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              disabled={criarSolicitacao.isPending}
            >
              {criarSolicitacao.isPending ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}