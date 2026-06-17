import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { cliente_nome, texto_otimizacao } = body;

        if (!cliente_nome || !texto_otimizacao) {
            return Response.json({ error: 'cliente_nome e texto_otimizacao são obrigatórios' }, { status: 400 });
        }

        const prompt = `Você é um especialista em Meta Ads que precisa comunicar ações técnicas de otimização para um cliente de forma profissional, clara e não técnica.

Cliente: ${cliente_nome}

Dados da otimização realizada:
${texto_otimizacao}

Instruções:
1. Transforme a linguagem técnica em uma comunicação profissional e acessível
2. Seja direto, objetivo e transparente
3. Use um tom profissional mas amigável
4. Comece com "📊 Atualização Meta Ads" ou similar
5. Explique o que foi feito e o benefício esperado
6. Termine com uma nota de acompanhamento (ex: "Sigo acompanhando de perto e retorno com os próximos passos")
7. Máximo 3 parágrafos curtos
8. NÃO use linguagem excessivamente técnica (CPM, CTR, frequência) - explique os conceitos em linguagem simples
9. NÃO inclua saudações como "Olá" ou "Prezado" - vá direto ao ponto
10. NÃO assine a mensagem`;

        const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            model: 'claude_sonnet_4_6'
        });

        let mensagem = typeof response === 'string' ? response : response?.content || response?.text || '';

        return Response.json({ mensagem: mensagem.trim() });
    } catch (error) {
        console.error('Erro ao gerar mensagem:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});