import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Building2, 
  Search, 
  BarChart3,
  FileText,
  Wallet,
  Zap,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BoasVindas() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState('boas-vindas'); // 'boas-vindas' | 'cadastro'
  
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState('cliente_usuario');
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [funcao, setFuncao] = useState('');
  const [search, setSearch] = useState('');

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesPublicos'],
    queryFn: () => base44.entities.Cliente.filter({ status: 'ativo' }, 'nome', 500),
    staleTime: 5 * 60 * 1000
  });

  const criarSolicitacao = useMutation({
    mutationFn: async () => {
      // Create user via invitation
      await base44.users.inviteUser(email, 'user');

      // Get the created user
      const allUsers = await base44.entities.User.list('-created_date', 100);
      const newUser = allUsers.find(u => u.email === email);

      if (newUser) {
        // Update user with additional info
        await base44.entities.User.update(newUser.id, {
          full_name: nome,
          tipo_usuario: tipoUsuario,
          status: 'pendente',
          cargo: funcao
        });

        // Create access request
        const contasNomes = contasSelecionadas.map(id => {
          const cliente = clientes.find(c => c.id === id);
          return cliente?.nome || id;
        });

        await base44.entities.AccessRequest.create({
          usuario_id: newUser.id,
          usuario_nome: nome,
          usuario_email: email,
          contas_solicitadas: contasSelecionadas,
          contas_solicitadas_nomes: contasNomes,
          motivo: `Função: ${funcao}`,
          status: 'pendente'
        });

        // Create notification for admins
        const admins = await base44.entities.User.filter({ 
          tipo_usuario: { $in: ['voxx_admin', 'voxx_manager'] }
        });
        
        for (const admin of admins) {
          await base44.entities.Notificacao.create({
            user_email: admin.email,
            tipo: 'nova_solicitacao',
            titulo: 'Nova Solicitação de Acesso',
            mensagem: `${nome} (${email}) solicitou acesso a ${contasSelecionadas.length} conta(s).`,
            lida: false
          });
        }
      }

      return true;
    },
    onSuccess: () => {
      toast.success('Solicitação enviada com sucesso!');
      // Reload to trigger the new routing logic
      window.location.reload();
    },
    onError: (error) => {
      toast.error('Erro ao enviar solicitação. Tente novamente.');
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!nome || !email || !senha || !funcao || contasSelecionadas.length === 0) {
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

  const toggleConta = (clienteId) => {
    if (contasSelecionadas.includes(clienteId)) {
      setContasSelecionadas(contasSelecionadas.filter(id => id !== clienteId));
    } else {
      setContasSelecionadas([...contasSelecionadas, clienteId]);
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(search.toLowerCase()) ||
    c.marca?.toLowerCase().includes(search.toLowerCase())
  );

  if (etapa === 'boas-vindas') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Logo e Título */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-bold text-white">V</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-3">
              Bem-vindo ao Portal Voxx
            </h1>
            <p className="text-xl text-slate-600">
              Acompanhe performance, demandas e entregas da sua unidade em um só lugar.
            </p>
          </div>

          {/* O que você encontra aqui */}
          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Performance de Campanhas</h3>
              <p className="text-sm text-slate-600">
                Acompanhe métricas de Meta e Google Ads em tempo real
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Status de Demandas</h3>
              <p className="text-sm text-slate-600">
                Veja o andamento de todas as suas solicitações
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Saldos e Investimentos</h3>
              <p className="text-sm text-slate-600">
                Controle financeiro e próximos investimentos
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Transparência Total</h3>
              <p className="text-sm text-slate-600">
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
              className="text-lg px-8 py-6 h-auto"
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
                  <SelectValue />
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
              <p className="text-sm text-slate-500">Selecione as unidades que você precisa acessar</p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar cliente, cidade ou marca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {clientesFiltrados.map(cliente => (
                <label
                  key={cliente.id}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                >
                  <Checkbox
                    checked={contasSelecionadas.includes(cliente.id)}
                    onCheckedChange={() => toggleConta(cliente.id)}
                  />
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{cliente.nome}</p>
                    <p className="text-xs text-slate-500">
                      {cliente.cidade}, {cliente.estado}
                      {cliente.marca && ` • ${cliente.marca}`}
                    </p>
                  </div>
                </label>
              ))}

              {clientesFiltrados.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <p>Nenhuma conta encontrada</p>
                </div>
              )}
            </div>

            {contasSelecionadas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contasSelecionadas.map(id => {
                  const cliente = clientes.find(c => c.id === id);
                  return (
                    <Badge key={id} variant="outline">
                      {cliente?.nome}
                    </Badge>
                  );
                })}
              </div>
            )}
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