import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════

function normalizarTexto(str) {
  if (!str) return '';
  return str.toString().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CATEGORIAS_VALIDAS = [
  'padrao_comunicacao', 'campanhas_trafego', 'criacao_artes',
  'conteudo_redes_sociais', 'operacao_atendimento',
  'reclamacoes_sensiveis', 'contratos_financeiro'
];

const TIPOS_ORIENTACAO_VALIDOS = [
  'tom_linguagem', 'regra_operacional', 'restricao', 'procedimento',
  'info_autorizada', 'info_exige_confirmacao', 'revisao_obrigatoria'
];

const TIPOS_EXIGEM_CHAVE = [
  'regra_operacional', 'restricao', 'info_autorizada',
  'info_exige_confirmacao', 'revisao_obrigatoria'
];

const TIPOS_CLIENTE = ['cliente_admin', 'cliente_usuario', 'oral_sin_franqueadora'];

function validarEscopo(dados) {
  const seg = (dados.escopo_segmento || '').trim();
  const mar = (dados.escopo_marca || '').trim();
  const cli = (dados.escopo_cliente_id || '').trim();

  if (dados.escopo_tipo === 'global') {
    if (seg || mar || cli) return { valido: false, erro: 'Escopo global não pode ter segmento, marca ou cliente preenchido.' };
  } else if (dados.escopo_tipo === 'segmento') {
    if (!seg) return { valido: false, erro: 'Escopo segmento exige escopo_segmento preenchido.' };
    if (mar || cli) return { valido: false, erro: 'Escopo segmento não pode ter marca ou cliente preenchido.' };
  } else if (dados.escopo_tipo === 'marca') {
    if (!mar) return { valido: false, erro: 'Escopo marca exige escopo_marca preenchido.' };
    if (seg || cli) return { valido: false, erro: 'Escopo marca não pode ter segmento ou cliente preenchido.' };
  } else if (dados.escopo_tipo === 'cliente') {
    if (!cli) return { valido: false, erro: 'Escopo cliente exige escopo_cliente_id preenchido.' };
    if (seg || mar) return { valido: false, erro: 'Escopo cliente não pode ter segmento ou marca preenchido.' };
  } else {
    return { valido: false, erro: 'escopo_tipo inválido.' };
  }
  return { valido: true };
}

function validarOrientacao(dados) {
  if (!dados.titulo || !dados.titulo.trim()) return { valido: false, erro: 'titulo é obrigatório.' };
  if (!dados.conteudo || !dados.conteudo.trim()) return { valido: false, erro: 'conteudo é obrigatório.' };
  if (dados.conteudo.length > 800) return { valido: false, erro: 'conteudo deve ter no máximo 800 caracteres.' };
  if (!CATEGORIAS_VALIDAS.includes(dados.categoria)) return { valido: false, erro: 'categoria inválida.' };
  if (!TIPOS_ORIENTACAO_VALIDOS.includes(dados.tipo_orientacao)) return { valido: false, erro: 'tipo_orientacao inválido.' };

  const escopoResult = validarEscopo(dados);
  if (!escopoResult.valido) return escopoResult;

  if (dados.prioridade !== undefined && dados.prioridade !== null) {
    const p = Number(dados.prioridade);
    if (isNaN(p) || p < 1 || p > 10) return { valido: false, erro: 'prioridade deve estar entre 1 e 10.' };
  }

  if (TIPOS_EXIGEM_CHAVE.includes(dados.tipo_orientacao)) {
    if (!dados.chave_tematica || !dados.chave_tematica.trim()) {
      return { valido: false, erro: `chave_tematica é obrigatória para tipo_orientacao=${dados.tipo_orientacao}.` };
    }
  }

  if (dados.palavras_chave !== undefined && dados.palavras_chave !== null && !Array.isArray(dados.palavras_chave)) {
    return { valido: false, erro: 'palavras_chave deve ser uma lista.' };
  }

  return { valido: true };
}

async function verificarConflito(sdk, dados, excludeId) {
  if (!dados.chave_tematica || !dados.chave_tematica.trim()) return [];

  const filtros = {
    ativa: true,
    chave_tematica: dados.chave_tematica,
    categoria: dados.categoria,
    escopo_tipo: dados.escopo_tipo,
    prioridade: Number(dados.prioridade) || 5
  };

  const candidatas = await sdk.entities.CopilotConhecimento.filter(filtros);
  let conflitos = candidatas.filter(o => o.id !== excludeId);

  // Normalized scope comparison (case/accent insensitive)
  if (dados.escopo_tipo === 'global') {
    conflitos = conflitos.filter(o =>
      (!o.escopo_segmento || !o.escopo_segmento.trim()) &&
      (!o.escopo_marca || !o.escopo_marca.trim()) &&
      (!o.escopo_cliente_id || !o.escopo_cliente_id.trim())
    );
  } else if (dados.escopo_tipo === 'segmento') {
    const norm = normalizarTexto(dados.escopo_segmento);
    conflitos = conflitos.filter(o => normalizarTexto(o.escopo_segmento) === norm);
  } else if (dados.escopo_tipo === 'marca') {
    const norm = normalizarTexto(dados.escopo_marca);
    conflitos = conflitos.filter(o => normalizarTexto(o.escopo_marca) === norm);
  } else if (dados.escopo_tipo === 'cliente') {
    conflitos = conflitos.filter(o => o.escopo_cliente_id === dados.escopo_cliente_id);
  }

  return conflitos;
}

async function criarSnapshot(sdk, orientacao, camposAlterados, usuario, motivo, substituiuId) {
  await sdk.entities.CopilotConhecimentoVersao.create({
    orientacao_id: orientacao.id,
    versao: orientacao.versao_atual || 1,
    titulo: orientacao.titulo,
    conteudo: orientacao.conteudo,
    categoria: orientacao.categoria,
    tipo_orientacao: orientacao.tipo_orientacao,
    escopo_tipo: orientacao.escopo_tipo,
    escopo_segmento: orientacao.escopo_segmento,
    escopo_marca: orientacao.escopo_marca,
    escopo_cliente_id: orientacao.escopo_cliente_id,
    escopo_cliente_nome: orientacao.escopo_cliente_nome,
    chave_tematica: orientacao.chave_tematica,
    prioridade: orientacao.prioridade,
    palavras_chave: orientacao.palavras_chave || [],
    obrigatoria: orientacao.obrigatoria,
    exige_verificacao: orientacao.exige_verificacao,
    ativa: orientacao.ativa,
    campos_alterados: camposAlterados || [],
    alterado_por_nome: usuario.nome,
    alterado_por_email: usuario.email,
    data_alteracao: new Date().toISOString(),
    motivo_edicao: motivo || '',
    substituiu_orientacao_id: substituiuId || null
  });
}

async function autorizarUsuario(sdk, user, acao, categoria) {
  const tipoUsuario = user.tipo_usuario || user.tipo_acesso;

  if (!tipoUsuario || TIPOS_CLIENTE.includes(tipoUsuario)) {
    return { autorizado: false, erro: 'Acesso negado.', status: 403 };
  }

  // Camada 1 — acesso à página (UserTypePermissions)
  const perms = await sdk.entities.UserTypePermissions.filter({ tipo_usuario: tipoUsuario });
  if (!perms || perms.length === 0) {
    return { autorizado: false, erro: 'Tipo de usuário sem configuração de acesso.', status: 403 };
  }
  const temAcessoPagina = (perms[0].paginas_permitidas || []).includes('BaseConhecimentoCopilot');
  if (!temAcessoPagina) {
    return { autorizado: false, erro: 'Sem acesso à página Base Conhecimento Copilot.', status: 403 };
  }

  // Camada 2 — ação interna (CopilotPermissao)
  const copilotPerms = await sdk.entities.CopilotPermissao.filter({ tipo_usuario: tipoUsuario });

  if (copilotPerms.length > 1) {
    console.warn(`[CopilotKB] Duplicidade CopilotPermissao: tipo=${tipoUsuario} ids=${copilotPerms.map(p => p.id).join(',')}`);
    return { autorizado: false, erro: 'Múltiplos registros de permissão encontrados. Contate o administrador.', status: 500 };
  }
  if (copilotPerms.length === 0) {
    return { autorizado: false, erro: 'Sem configuração de permissão para o Copilot.', status: 403 };
  }

  const perm = copilotPerms[0];

  const mapaAcoes = {
    'listar': 'pode_visualizar',
    'consultar': 'pode_visualizar',
    'criar': 'pode_criar',
    'editar': 'pode_editar',
    'ativar': 'pode_ativar_desativar',
    'desativar': 'pode_ativar_desativar',
    'historico': 'pode_visualizar_historico',
    'restaurar': 'pode_restaurar_versao',
    'substituir': 'pode_criar',
  };

  const campoPerm = mapaAcoes[acao];
  if (!campoPerm || !perm[campoPerm]) {
    return { autorizado: false, erro: `Sem permissão para a ação: ${acao}.`, status: 403 };
  }

  // Restrição por categoria (ações de escrita)
  const acoesEscrita = ['criar', 'editar', 'ativar', 'desativar', 'restaurar', 'substituir'];
  if (acoesEscrita.includes(acao) && categoria) {
    const cats = perm.categorias_administraveis || [];
    if (!cats.includes(categoria)) {
      return { autorizado: false, erro: `Sem permissão para administrar a categoria: ${categoria}.`, status: 403 };
    }
  }

  return { autorizado: true, perm, tipoUsuario };
}

function getUsuarioInfo(user) {
  return {
    nome: user.full_name || user.nome_customizado || user.email || '',
    email: user.email || ''
  };
}

// ════════════════════════════════════════════════════════════
//  HANDLER
// ════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { acao } = body;
    const sdk = base44.asServiceRole;

    if (!acao) return Response.json({ error: 'acao é obrigatória' }, { status: 400 });

    const usuario = getUsuarioInfo(user);

    // ── LISTAR ──────────────────────────────────────────────
    if (acao === 'listar') {
      const auth = await autorizarUsuario(sdk, user, 'listar');
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      const { categoria, escopo_tipo, ativa, busca } = body;
      const filtros = {};
      if (categoria) filtros.categoria = categoria;
      if (escopo_tipo) filtros.escopo_tipo = escopo_tipo;
      if (ativa !== undefined) filtros.ativa = ativa;

      let orientacoes = await sdk.entities.CopilotConhecimento.filter(filtros, '-updated_date', 200);

      if (busca) {
        const norm = normalizarTexto(busca);
        orientacoes = orientacoes.filter(o =>
          normalizarTexto(o.titulo).includes(norm) ||
          normalizarTexto(o.conteudo).includes(norm)
        );
      }

      return Response.json({ orientacoes });
    }

    // ── CONSULTAR ──────────────────────────────────────────
    if (acao === 'consultar') {
      const auth = await autorizarUsuario(sdk, user, 'consultar');
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      const { orientacao_id } = body;
      if (!orientacao_id) return Response.json({ error: 'orientacao_id é obrigatório' }, { status: 400 });

      const orientacao = await sdk.entities.CopilotConhecimento.get(orientacao_id);
      return Response.json({ orientacao });
    }

    // ── CRIAR ──────────────────────────────────────────────
    if (acao === 'criar') {
      const dados = body.dados || {};
      const auth = await autorizarUsuario(sdk, user, 'criar', dados.categoria);
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      const validacao = validarOrientacao(dados);
      if (!validacao.valido) return Response.json({ error: validacao.erro }, { status: 400 });

      if (dados.escopo_tipo === 'cliente') {
        try {
          const cliente = await sdk.entities.Cliente.get(dados.escopo_cliente_id);
          dados.escopo_cliente_nome = cliente.nome || '';
        } catch (_) {
          return Response.json({ error: 'Cliente informado não encontrado.' }, { status: 400 });
        }
      } else {
        dados.escopo_cliente_nome = '';
      }

      const conflitos = await verificarConflito(sdk, dados, null);
      if (conflitos.length > 0) {
        return Response.json({
          conflito: true,
          conflitante_id: conflitos[0].id,
          mensagem: 'Já existe uma orientação ativa com a mesma combinação de chave temática, categoria, escopo e prioridade.'
        }, { status: 409 });
      }

      const novo = await sdk.entities.CopilotConhecimento.create({
        ...dados,
        prioridade: Number(dados.prioridade) || 5,
        palavras_chave: dados.palavras_chave || [],
        ativa: true,
        versao_atual: 1,
        criado_por_nome: usuario.nome,
        criado_por_email: usuario.email,
        atualizado_por_nome: usuario.nome,
        atualizado_por_email: usuario.email
      });

      return Response.json({ orientacao: novo, id: novo.id });
    }

    // ── EDITAR ─────────────────────────────────────────────
    if (acao === 'editar') {
      const { orientacao_id, dados, motivo } = body;
      if (!orientacao_id) return Response.json({ error: 'orientacao_id é obrigatório' }, { status: 400 });

      const orientacao = await sdk.entities.CopilotConhecimento.get(orientacao_id);
      const auth = await autorizarUsuario(sdk, user, 'editar', dados?.categoria || orientacao.categoria);
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      // Prevenir troca de categoria para não permitida
      if (dados.categoria && dados.categoria !== orientacao.categoria) {
        const cats = auth.perm.categorias_administraveis || [];
        if (!cats.includes(dados.categoria)) {
          return Response.json({ error: `Sem permissão para alterar para a categoria: ${dados.categoria}.` }, { status: 403 });
        }
      }

      const dadosCompletos = { ...orientacao, ...dados };
      const validacao = validarOrientacao(dadosCompletos);
      if (!validacao.valido) return Response.json({ error: validacao.erro }, { status: 400 });

      if (dadosCompletos.escopo_tipo === 'cliente' && dados.escopo_cliente_id && dados.escopo_cliente_id !== orientacao.escopo_cliente_id) {
        try {
          const cliente = await sdk.entities.Cliente.get(dadosCompletos.escopo_cliente_id);
          dadosCompletos.escopo_cliente_nome = cliente.nome || '';
        } catch (_) {
          return Response.json({ error: 'Cliente informado não encontrado.' }, { status: 400 });
        }
      }
      if (dadosCompletos.escopo_tipo !== 'cliente') {
        dadosCompletos.escopo_cliente_nome = '';
      }

      const camposAlterados = [];
      const camposVerificar = ['titulo','conteudo','categoria','tipo_orientacao','escopo_tipo','escopo_segmento','escopo_marca','escopo_cliente_id','escopo_cliente_nome','chave_tematica','prioridade','palavras_chave','obrigatoria','exige_verificacao'];
      for (const campo of camposVerificar) {
        if (dados[campo] !== undefined && JSON.stringify(dados[campo]) !== JSON.stringify(orientacao[campo])) {
          camposAlterados.push(campo);
        }
      }

      if (camposAlterados.length === 0) {
        return Response.json({ error: 'Nenhuma alteração detectada.' }, { status: 400 });
      }

      const conflitos = await verificarConflito(sdk, dadosCompletos, orientacao_id);
      if (conflitos.length > 0) {
        return Response.json({
          conflito: true,
          conflitante_id: conflitos[0].id,
          mensagem: 'Conflito detectado com outra orientação ativa.'
        }, { status: 409 });
      }

      await criarSnapshot(sdk, orientacao, camposAlterados, usuario, motivo || 'Edição', null);

      const atualizado = await sdk.entities.CopilotConhecimento.update(orientacao_id, {
        ...dados,
        escopo_cliente_nome: dadosCompletos.escopo_cliente_nome,
        prioridade: Number(dadosCompletos.prioridade) || 5,
        versao_atual: (orientacao.versao_atual || 1) + 1,
        atualizado_por_nome: usuario.nome,
        atualizado_por_email: usuario.email
      });

      return Response.json({ orientacao: atualizado });
    }

    // ── ATIVAR / DESATIVAR ─────────────────────────────────
    if (acao === 'ativar' || acao === 'desativar') {
      const { orientacao_id, motivo } = body;
      if (!orientacao_id) return Response.json({ error: 'orientacao_id é obrigatório' }, { status: 400 });

      const orientacao = await sdk.entities.CopilotConhecimento.get(orientacao_id);
      const novoStatus = acao === 'ativar';

      const auth = await autorizarUsuario(sdk, user, acao, orientacao.categoria);
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      if (novoStatus && !orientacao.ativa) {
        const conflitos = await verificarConflito(sdk, orientacao, orientacao_id);
        if (conflitos.length > 0) {
          return Response.json({
            conflito: true,
            conflitante_id: conflitos[0].id,
            mensagem: 'Não é possível ativar: existe outra orientação ativa em conflito.'
          }, { status: 409 });
        }
      }

      if (orientacao.ativa !== novoStatus) {
        await criarSnapshot(sdk, orientacao, ['ativa'], usuario, motivo || (novoStatus ? 'Ativação' : 'Desativação'), null);
      }

      const atualizado = await sdk.entities.CopilotConhecimento.update(orientacao_id, {
        ativa: novoStatus,
        atualizado_por_nome: usuario.nome,
        atualizado_por_email: usuario.email
      });

      return Response.json({ orientacao: atualizado });
    }

    // ── HISTÓRICO ──────────────────────────────────────────
    if (acao === 'historico') {
      const { orientacao_id } = body;
      if (!orientacao_id) return Response.json({ error: 'orientacao_id é obrigatório' }, { status: 400 });

      const orientacao = await sdk.entities.CopilotConhecimento.get(orientacao_id);
      const auth = await autorizarUsuario(sdk, user, 'historico');
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      const versoes = await sdk.entities.CopilotConhecimentoVersao.filter(
        { orientacao_id },
        '-data_alteracao',
        100
      );

      return Response.json({ orientacao, versoes });
    }

    // ── RESTAURAR ──────────────────────────────────────────
    if (acao === 'restaurar') {
      const { orientacao_id, versao_id, motivo } = body;
      if (!orientacao_id || !versao_id) return Response.json({ error: 'orientacao_id e versao_id são obrigatórios' }, { status: 400 });

      const orientacao = await sdk.entities.CopilotConhecimento.get(orientacao_id);
      const versao = await sdk.entities.CopilotConhecimentoVersao.get(versao_id);

      if (versao.orientacao_id !== orientacao_id) {
        return Response.json({ error: 'A versão não pertence a esta orientação.' }, { status: 400 });
      }

      const auth = await autorizarUsuario(sdk, user, 'restaurar', versao.categoria);
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      const dadosRestaurados = {
        titulo: versao.titulo,
        conteudo: versao.conteudo,
        categoria: versao.categoria,
        tipo_orientacao: versao.tipo_orientacao,
        escopo_tipo: versao.escopo_tipo,
        escopo_segmento: versao.escopo_segmento,
        escopo_marca: versao.escopo_marca,
        escopo_cliente_id: versao.escopo_cliente_id,
        escopo_cliente_nome: versao.escopo_cliente_nome,
        chave_tematica: versao.chave_tematica,
        prioridade: versao.prioridade,
        palavras_chave: versao.palavras_chave || [],
        obrigatoria: versao.obrigatoria,
        exige_verificacao: versao.exige_verificacao,
      };

      const validacao = validarOrientacao(dadosRestaurados);
      if (!validacao.valido) return Response.json({ error: validacao.erro }, { status: 400 });

      const conflitos = await verificarConflito(sdk, dadosRestaurados, orientacao_id);
      if (conflitos.length > 0) {
        return Response.json({
          conflito: true,
          conflitante_id: conflitos[0].id,
          mensagem: 'Não é possível restaurar: existe outra orientação ativa em conflito.'
        }, { status: 409 });
      }

      await criarSnapshot(sdk, orientacao, ['restauracao'], usuario, motivo || `Restauração para versão ${versao.versao}`, null);

      const atualizado = await sdk.entities.CopilotConhecimento.update(orientacao_id, {
        ...dadosRestaurados,
        versao_atual: (orientacao.versao_atual || 1) + 1,
        atualizado_por_nome: usuario.nome,
        atualizado_por_email: usuario.email
      });

      return Response.json({ orientacao: atualizado });
    }

    // ── SUBSTITUIR ─────────────────────────────────────────
    if (acao === 'substituir') {
      const { orientacao_substituida_id, dados, motivo } = body;
      if (!orientacao_substituida_id) return Response.json({ error: 'orientacao_substituida_id é obrigatório' }, { status: 400 });

      const dadosOrientacao = dados || {};
      const auth = await autorizarUsuario(sdk, user, 'substituir', dadosOrientacao.categoria);
      if (!auth.autorizado) return Response.json({ error: auth.erro }, { status: auth.status });

      const validacao = validarOrientacao(dadosOrientacao);
      if (!validacao.valido) return Response.json({ error: validacao.erro }, { status: 400 });

      if (dadosOrientacao.escopo_tipo === 'cliente') {
        try {
          const cliente = await sdk.entities.Cliente.get(dadosOrientacao.escopo_cliente_id);
          dadosOrientacao.escopo_cliente_nome = cliente.nome || '';
        } catch (_) {
          return Response.json({ error: 'Cliente informado não encontrado.' }, { status: 400 });
        }
      } else {
        dadosOrientacao.escopo_cliente_nome = '';
      }

      // Confirmar que a orientação a ser substituída ainda está ativa
      const substituida = await sdk.entities.CopilotConhecimento.get(orientacao_substituida_id);
      if (!substituida.ativa) {
        return Response.json({ error: 'A orientação a ser substituída não está mais ativa. Operação cancelada.' }, { status: 409 });
      }

      // Verificar que o conflito ainda existe (prevenção de race condition)
      const conflitos = await verificarConflito(sdk, dadosOrientacao, null);
      const aindaConflita = conflitos.some(o => o.id === orientacao_substituida_id);
      if (!aindaConflita) {
        return Response.json({ error: 'Os dados mudaram desde a detecção do conflito. Verifique novamente.' }, { status: 409 });
      }

      // 1. Snapshot da substituída
      await criarSnapshot(sdk, substituida, ['substituicao'], usuario, motivo || 'Substituída por nova orientação', null);

      // 2. Desativar a anterior
      await sdk.entities.CopilotConhecimento.update(orientacao_substituida_id, {
        ativa: false,
        atualizado_por_nome: usuario.nome,
        atualizado_por_email: usuario.email
      });

      // 3. Criar a nova, registrando a substituição
      const nova = await sdk.entities.CopilotConhecimento.create({
        ...dadosOrientacao,
        prioridade: Number(dadosOrientacao.prioridade) || 5,
        palavras_chave: dadosOrientacao.palavras_chave || [],
        ativa: true,
        versao_atual: 1,
        substituiu_orientacao_id: orientacao_substituida_id,
        criado_por_nome: usuario.nome,
        criado_por_email: usuario.email,
        atualizado_por_nome: usuario.nome,
        atualizado_por_email: usuario.email
      });

      return Response.json({ orientacao: nova, substituida_id: orientacao_substituida_id });
    }

    return Response.json({ error: `Ação desconhecida: ${acao}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
});