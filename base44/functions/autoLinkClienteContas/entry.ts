import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Auto-links Cliente records to ContaMetaAds and GoogleAdsAccount
 * by fuzzy-matching the account_name to the cliente nome.
 * Only updates clients that don't have meta_ads_account_name or google_ads_account_name set.
 */

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  // Token overlap
  const ta = new Set(na.split(' ').filter(t => t.length > 2));
  const tb = new Set(nb.split(' ').filter(t => t.length > 2));
  const intersection = [...ta].filter(t => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 ? intersection / union : 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all data
    const [clientes, metaContas, googleContas] = await Promise.all([
      base44.asServiceRole.entities.Cliente.list('-created_date', 500),
      base44.asServiceRole.entities.ContaMetaAds.list('-created_date', 500),
      base44.asServiceRole.entities.GoogleAdsAccount.list('-data_atualizacao', 500),
    ]);

    const metaAccountNames = metaContas.map(c => c.account_name);
    const googleAccountNames = googleContas.map(c => c.account_name);

    const results = [];

    for (const cliente of clientes) {
      const nome = cliente.nome;
      if (!nome) continue;

      const updates = {};

      // --- Meta Ads matching ---
      if (!cliente.meta_ads_account_name) {
        let bestMeta = null;
        let bestMetaScore = 0;

        for (const accountName of metaAccountNames) {
          const score = similarity(nome, accountName);
          if (score > bestMetaScore) {
            bestMetaScore = score;
            bestMeta = accountName;
          }
        }

        if (bestMetaScore >= 0.5) {
          updates.meta_ads_account_name = bestMeta;
        }
      }

      // --- Google Ads matching ---
      if (!cliente.google_ads_account_name) {
        let bestGoogle = null;
        let bestGoogleScore = 0;

        for (const accountName of googleAccountNames) {
          const score = similarity(nome, accountName);
          if (score > bestGoogleScore) {
            bestGoogleScore = score;
            bestGoogle = accountName;
          }
        }

        if (bestGoogleScore >= 0.5) {
          updates.google_ads_account_name = bestGoogle;
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Cliente.update(cliente.id, updates);
        results.push({
          cliente: nome,
          ...updates,
        });
      }
    }

    return Response.json({
      success: true,
      updated: results.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});