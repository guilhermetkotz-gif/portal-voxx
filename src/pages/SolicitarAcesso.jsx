import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Building2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SolicitarAcesso() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [search, setSearch] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesPublicos'],
    queryFn: () => base44.entities.Cliente.filter({ status: 'ativo' }, 'nome', 500),
    staleTime: 5 * 60 * 1000
  });

  const criarSolicitacao = useMutation({
    mutationFn: async (data) => {
      // Create user via invitation (will create user with pendente status)
      await base44.users.inviteUser(email, 'user');

      // Get the created user
      const allUsers = await base44.entities.User.list('-created_date', 100);
      const newUser = allUsers.find(u => u.email === email);

      if (newUser) {
        // Update user with additional info
        await base44.entities.User.update(newUser.id, {
          tipo_usuario: 'cliente_usuario',
          status: 'pendente'
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
          motivo: data.motivo,
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
      setSucesso(true);
      toast.success('Solicitação enviada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao enviar solicitação. Tente novamente.');
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!nome || !email || !senha || !motivo || contasSelecionadas.length === 0) {
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

    criarSolicitacao.mutate({ motivo });
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

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Solicitação Enviada!</h1>
          <p className="text-slate-600 mb-6">
            Sua solicitação foi registrada e está em análise pela Voxx Marketing. 
            Você receberá um e-mail assim que seu acesso for aprovado.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm text-blue-900 font-medium mb-2">📧 Próximos passos:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Verificar seu e-mail ({email})</li>
              <li>• Aguardar aprovação da Voxx (até 24h úteis)</li>
              <li>• Fazer login após receber confirmação</li>
            </ul>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Portal Voxx</h1>
          <p className="text-slate-600">Solicite acesso às suas contas</p>
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
          </div>

          {/* Contas */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Contas/Unidades *</h3>
              <p className="text-sm text-slate-500">Selecione as contas que você precisa acessar</p>
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

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo da Solicitação *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Sou gestor da unidade X, Sou CRC responsável, Trabalho no marketing..."
              className="min-h-[100px]"
              required
            />
            <p className="text-xs text-slate-500">
              Explique por que você precisa acessar essas contas. Isso ajuda na aprovação.
            </p>
          </div>

          {/* Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Aprovação necessária</p>
              <p>Sua solicitação será analisada pela equipe Voxx. O acesso será liberado em até 24 horas úteis.</p>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={criarSolicitacao.isPending}
          >
            {criarSolicitacao.isPending ? 'Enviando...' : 'Enviar Solicitação'}
          </Button>
        </form>
      </Card>
    </div>
  );
}