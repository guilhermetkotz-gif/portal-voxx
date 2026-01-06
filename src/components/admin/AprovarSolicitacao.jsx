import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AprovarSolicitacao({ solicitacao, onClose, currentUser }) {
  const queryClient = useQueryClient();
  const [contasSelecionadas, setContasSelecionadas] = useState(solicitacao.contas_solicitadas || []);
  const [nivelAcesso, setNivelAcesso] = useState('viewer');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');

  const aprovarSolicitacao = useMutation({
    mutationFn: async () => {
      // Criar acessos
      for (const clienteId of contasSelecionadas) {
        const clienteNome = solicitacao.contas_solicitadas_nomes[
          solicitacao.contas_solicitadas.indexOf(clienteId)
        ];
        
        await base44.entities.UserClientAccess.create({
          usuario_id: solicitacao.usuario_id,
          usuario_email: solicitacao.usuario_email,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          nivel_acesso: nivelAcesso,
          status: 'ativo',
          data_atribuicao: new Date().toISOString(),
          atribuido_por_usuario_id: currentUser.id,
          atribuido_por_nome: currentUser.full_name
        });
      }

      // Atualizar status da solicitação
      const statusFinal = contasSelecionadas.length === solicitacao.contas_solicitadas.length 
        ? 'aprovado' 
        : 'aprovado_parcial';

      await base44.entities.AccessRequest.update(solicitacao.id, {
        status: statusFinal,
        decidido_em: new Date().toISOString(),
        decidido_por_usuario_id: currentUser.id,
        decidido_por_nome: currentUser.full_name,
        observacao_admin: observacao,
        contas_aprovadas: contasSelecionadas
      });

      // Atualizar usuário para ativo
      await base44.entities.User.update(solicitacao.usuario_id, {
        status: 'ativo'
      });

      // Log
      await base44.entities.LogAuditoria.create({
        acao: 'APPROVE_REQUEST',
        usuario_id: currentUser.id,
        usuario_email: currentUser.email,
        entidade: 'AccessRequest',
        entidade_id: solicitacao.id,
        detalhes: {
          usuario_afetado: solicitacao.usuario_email,
          contas_aprovadas: contasSelecionadas,
          status: statusFinal
        }
      });

      // Criar notificação
      await base44.entities.Notificacao.create({
        user_email: solicitacao.usuario_email,
        tipo: 'aprovacao_acesso',
        titulo: 'Acesso Aprovado',
        mensagem: `Seu acesso ao Portal Voxx foi aprovado! Você já pode visualizar ${contasSelecionadas.length} conta(s).`,
        lida: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoesAcesso'] });
      queryClient.invalidateQueries({ queryKey: ['todosAcessos'] });
      queryClient.invalidateQueries({ queryKey: ['todosUsuarios'] });
      toast.success('Solicitação aprovada com sucesso');
      onClose();
    }
  });

  const rejeitarSolicitacao = useMutation({
    mutationFn: async () => {
      await base44.entities.AccessRequest.update(solicitacao.id, {
        status: 'rejeitado',
        decidido_em: new Date().toISOString(),
        decidido_por_usuario_id: currentUser.id,
        decidido_por_nome: currentUser.full_name,
        observacao_admin: motivo
      });

      await base44.entities.LogAuditoria.create({
        acao: 'REJECT_REQUEST',
        usuario_id: currentUser.id,
        usuario_email: currentUser.email,
        entidade: 'AccessRequest',
        entidade_id: solicitacao.id,
        detalhes: {
          usuario_afetado: solicitacao.usuario_email,
          motivo
        }
      });

      // Notificar usuário
      await base44.entities.Notificacao.create({
        user_email: solicitacao.usuario_email,
        tipo: 'rejeicao_acesso',
        titulo: 'Solicitação de Acesso Rejeitada',
        mensagem: `Sua solicitação foi analisada e não pode ser aprovada. Motivo: ${motivo}`,
        lida: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoesAcesso'] });
      toast.success('Solicitação rejeitada');
      onClose();
    }
  });

  const toggleConta = (clienteId) => {
    if (contasSelecionadas.includes(clienteId)) {
      setContasSelecionadas(contasSelecionadas.filter(id => id !== clienteId));
    } else {
      setContasSelecionadas([...contasSelecionadas, clienteId]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aprovar Solicitação</h1>
          <p className="text-slate-500">{solicitacao.usuario_nome} ({solicitacao.usuario_email})</p>
        </div>
      </div>

      {/* Info */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">Motivo da Solicitação</h3>
            <p className="text-slate-600">{solicitacao.motivo}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">
              Solicitado {formatDistanceToNow(new Date(solicitacao.created_date), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        </div>
      </Card>

      {/* Contas Solicitadas */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Contas Solicitadas</h3>
        <p className="text-sm text-slate-500 mb-4">Selecione quais contas serão aprovadas:</p>
        
        <div className="space-y-2">
          {solicitacao.contas_solicitadas?.map((clienteId, index) => (
            <div key={clienteId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Checkbox
                checked={contasSelecionadas.includes(clienteId)}
                onCheckedChange={() => toggleConta(clienteId)}
              />
              <Building2 className="w-5 h-5 text-slate-400" />
              <span className="font-medium text-slate-900">
                {solicitacao.contas_solicitadas_nomes?.[index] || clienteId}
              </span>
            </div>
          ))}
        </div>

        {contasSelecionadas.length < solicitacao.contas_solicitadas.length && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Aprovação parcial: {contasSelecionadas.length} de {solicitacao.contas_solicitadas.length} contas selecionadas
            </p>
          </div>
        )}
      </Card>

      {/* Nível de Acesso */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Nível de Acesso</h3>
        <Select value={nivelAcesso} onValueChange={setNivelAcesso}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer (apenas visualizar)</SelectItem>
            <SelectItem value="editor">Editor (pode criar demandas e comentar)</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* Observação */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Observação (opcional)</h3>
        <Textarea
          placeholder="Adicione uma observação sobre esta aprovação..."
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="min-h-[80px]"
        />
      </Card>

      {/* Ações */}
      <div className="flex gap-3">
        <Button
          onClick={() => aprovarSolicitacao.mutate()}
          disabled={contasSelecionadas.length === 0 || aprovarSolicitacao.isPending}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Aprovar
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const motivoInput = prompt('Digite o motivo da rejeição:');
            if (motivoInput) {
              setMotivo(motivoInput);
              rejeitarSolicitacao.mutate();
            }
          }}
          disabled={rejeitarSolicitacao.isPending}
          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Rejeitar
        </Button>
      </div>
    </div>
  );
}