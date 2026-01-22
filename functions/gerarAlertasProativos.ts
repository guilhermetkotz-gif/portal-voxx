import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current month
    const now = new Date();
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    // Fetch all balance controls for current month
    const balances = await base44.asServiceRole.entities.MetaAdsBalanceControl.filter({
      month_year: mesAtual
    });
    
    // Fetch all clients
    const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);
    const clientesMap = new Map(clientes.map(c => [c.id, c]));
    
    // Fetch all notification preferences
    const allPrefs = await base44.asServiceRole.entities.NotificationPreference.list('-updated_date', 500);
    const prefsMap = new Map();
    
    // Fetch all users to get their access
    const users = await base44.asServiceRole.entities.User.list('-updated_date', 500);
    
    // Fetch all user access
    const allAccess = await base44.asServiceRole.entities.UserClientAccess.filter({ status: 'ativo' });
    
    // Build user -> clients map
    const userClientsMap = new Map();
    
    for (const user of users) {
      if (user.role === 'admin' || user.tipo_usuario === 'voxx_admin') {
        userClientsMap.set(user.id, 'all');
      } else if (user.tipo_usuario === 'voxx_operacao' && user.clientes_atribuidos?.length > 0) {
        userClientsMap.set(user.id, user.clientes_atribuidos);
      } else {
        const userAccess = allAccess.filter(a => a.usuario_id === user.id);
        if (userAccess.length > 0) {
          userClientsMap.set(user.id, userAccess.map(a => a.cliente_id));
        }
      }
      
      // Get or create preferences
      const existingPref = allPrefs.find(p => p.usuario_id === user.id);
      if (existingPref) {
        prefsMap.set(user.id, existingPref);
      } else if (user.email) {
        prefsMap.set(user.id, {
          saldo_baixo_enabled: true,
          saldo_baixo_dias: 3,
          tomada_vencimento_enabled: true,
          tomada_vencimento_dias: 2,
          gasto_excedido_enabled: true,
          gasto_excedido_percentual: 120,
          enviar_email: true,
          enviar_inapp: true,
          frequencia_email: 'diario'
        });
      }
    }
    
    const alertasGerados = [];
    const emailsParaEnviar = [];
    
    // Process each balance
    for (const balance of balances) {
      const cliente = clientesMap.get(balance.client_id);
      if (!cliente) continue;
      
      const saldo = balance.saldo || 0;
      const gastoDiario = balance.gasto_diario || 0;
      const valorPlanejado = balance.valor_planejado_meta || 0;
      const historico = balance.historico_tomadas || [];
      
      // Calculate days until saldo runs out
      const diasRestantes = gastoDiario > 0 ? saldo / gastoDiario : 999;
      
      // Get users who should be notified about this client
      const usersToNotify = [];
      for (const [userId, clientIds] of userClientsMap.entries()) {
        if (clientIds === 'all' || clientIds.includes(balance.client_id)) {
          const user = users.find(u => u.id === userId);
          if (user?.email) {
            usersToNotify.push({ userId, email: user.email });
          }
        }
      }
      
      for (const { userId, email } of usersToNotify) {
        const prefs = prefsMap.get(userId);
        if (!prefs) continue;
        
        // ALERT 1: Saldo baixo
        if (prefs.saldo_baixo_enabled && diasRestantes <= prefs.saldo_baixo_dias && diasRestantes > 0) {
          const notif = {
            cliente_id: balance.client_id,
            user_email: email,
            tipo: 'saldo_baixo',
            titulo: `⚠️ Saldo Crítico: ${cliente.nome}`,
            mensagem: `O saldo atual (R$ ${saldo.toFixed(2)}) durará apenas ${Math.ceil(diasRestantes)} dias com o gasto diário de R$ ${gastoDiario.toFixed(2)}.`,
            lida: false,
            link: `/gestao-saldo-meta-ads?cliente=${balance.client_id}`
          };
          
          if (prefs.enviar_inapp) {
            alertasGerados.push(notif);
          }
          
          if (prefs.enviar_email && prefs.frequencia_email === 'imediato') {
            emailsParaEnviar.push({
              to: email,
              subject: notif.titulo,
              body: `${notif.mensagem}\n\nAcesse: ${notif.link}`
            });
          }
        }
        
        // ALERT 2: Tomadas próximas do vencimento
        if (prefs.tomada_vencimento_enabled) {
          const tomadasPendentes = historico.filter(t => !t.pago && t.data_envio);
          
          for (const tomada of tomadasPendentes) {
            const dataEnvio = new Date(tomada.data_envio);
            const diasAteVencimento = Math.ceil((dataEnvio - now) / (1000 * 60 * 60 * 24));
            
            if (diasAteVencimento >= 0 && diasAteVencimento <= prefs.tomada_vencimento_dias) {
              const notif = {
                cliente_id: balance.client_id,
                user_email: email,
                tipo: 'tomada_vencimento',
                titulo: `📅 Tomada Próxima: ${cliente.nome}`,
                mensagem: `Tomada #${tomada.numero} (R$ ${tomada.valor?.toFixed(2) || 0}) vence em ${diasAteVencimento} dia(s).`,
                lida: false,
                link: `/gestao-saldo-meta-ads?cliente=${balance.client_id}`
              };
              
              if (prefs.enviar_inapp) {
                alertasGerados.push(notif);
              }
              
              if (prefs.enviar_email && prefs.frequencia_email === 'imediato') {
                emailsParaEnviar.push({
                  to: email,
                  subject: notif.titulo,
                  body: `${notif.mensagem}\n\nAcesse: ${notif.link}`
                });
              }
            }
          }
        }
        
        // ALERT 3: Gasto excedido
        if (prefs.gasto_excedido_enabled && valorPlanejado > 0) {
          const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const gastoEsperado = valorPlanejado / diasNoMes;
          const percentualAtual = (gastoDiario / gastoEsperado) * 100;
          
          if (percentualAtual >= prefs.gasto_excedido_percentual) {
            const notif = {
              cliente_id: balance.client_id,
              user_email: email,
              tipo: 'gasto_excedido',
              titulo: `📊 Gasto Elevado: ${cliente.nome}`,
              mensagem: `Gasto diário atual (R$ ${gastoDiario.toFixed(2)}) está ${percentualAtual.toFixed(0)}% do planejado (R$ ${gastoEsperado.toFixed(2)}).`,
              lida: false,
              link: `/gestao-saldo-meta-ads?cliente=${balance.client_id}`
            };
            
            if (prefs.enviar_inapp) {
              alertasGerados.push(notif);
            }
            
            if (prefs.enviar_email && prefs.frequencia_email === 'imediato') {
              emailsParaEnviar.push({
                to: email,
                subject: notif.titulo,
                body: `${notif.mensagem}\n\nAcesse: ${notif.link}`
              });
            }
          }
        }
      }
    }
    
    // Save notifications
    if (alertasGerados.length > 0) {
      await base44.asServiceRole.entities.Notificacao.bulkCreate(alertasGerados);
    }
    
    // Send emails
    for (const email of emailsParaEnviar) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'Voxx Alertas',
          to: email.to,
          subject: email.subject,
          body: email.body
        });
      } catch (err) {
        console.error('Erro ao enviar email:', err);
      }
    }
    
    return Response.json({
      success: true,
      alertas_gerados: alertasGerados.length,
      emails_enviados: emailsParaEnviar.length
    });
    
  } catch (error) {
    console.error('Erro ao gerar alertas:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});