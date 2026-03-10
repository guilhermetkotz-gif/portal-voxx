import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('syncClientesFromSheets: starting Meta + Google Ads sync...');

    const [metaResult, googleResult] = await Promise.allSettled([
      base44.asServiceRole.functions.invoke('syncMetaAdsAccounts', {}),
      base44.asServiceRole.functions.invoke('syncGoogleAdsAccounts', {})
    ]);

    const metaData = metaResult.status === 'fulfilled' ? metaResult.value : null;
    const googleData = googleResult.status === 'fulfilled' ? googleResult.value : null;

    const metaError = metaResult.status === 'rejected' ? metaResult.reason?.message : (metaData?.error || null);
    const googleError = googleResult.status === 'rejected' ? googleResult.reason?.message : (googleData?.error || null);

    console.log('Meta sync result:', metaData);
    console.log('Google sync result:', googleData);

    return Response.json({
      success: true,
      meta: metaError ? { error: metaError } : { success: true, accountsProcessed: metaData?.accountsProcessed },
      google: googleError ? { error: googleError } : { success: true, accountsProcessed: googleData?.accountsProcessed }
    });

  } catch (error) {
    console.error('syncClientesFromSheets error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});