import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SolicitarAcesso() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [funcao, setFuncao] = useState('');
  const [contasTexto, setContasTexto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [sucesso, setSucesso] = useState(false);

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
          full_name: nome,
          tipo_usuario: 'cliente_usuario',
          status: 'pendente',
          cargo: funcao
        });

        // Create access request
        await base44.entities.AccessRequest.create({
          usuario_id: newUser.id,
          usuario_nome: nome,
          usuario_email: email,
          contas_solicitadas: [],
          contas_solicitadas_nomes: [],
          motivo: `${data.motivo}\n\nContas solicitadas: ${data.contasTexto}`,
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
            mensagem: `${nome} (${email}) solicitou acesso. Contas: ${data.contasTexto}`,
            lida: false
          });
        }
      }
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

    if (!nome || !email || !senha || !funcao || !motivo || !contasTexto.trim()) {
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

    criarSolicitacao.mutate({ motivo, contasTexto });
  };

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

            <div>
              <Label>Qual sua função na unidade? *</Label>
              <Input
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                placeholder="Ex: gestor, CRC, coordenador..."
                required
              />
            </div>
          </div>

          {/* Contas */}
          <div className="space-y-2">
            <Label>Contas/Unidades que deseja acessar *</Label>
            <Textarea
              value={contasTexto}
              onChange={(e) => setContasTexto(e.target.value)}
              placeholder="Ex: Oral Sin Maringá, Oral Sin Londrina, Clínica X..."
              className="min-h-[80px]"
              required
            />
            <p className="text-xs text-slate-500">
              Informe o nome das unidades/contas que você precisa visualizar.
            </p>
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