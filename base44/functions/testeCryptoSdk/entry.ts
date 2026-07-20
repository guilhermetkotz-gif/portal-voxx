import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const results = {};

    // Test 1: crypto.randomUUID()
    try {
      const uuid = crypto.randomUUID();
      results.crypto_uuid = {
        success: true,
        uuid,
        length: uuid.length,
        type: typeof uuid,
      };
    } catch (e) {
      results.crypto_uuid = { success: false, error: e.message };
    }

    // Test 2: crypto.getRandomValues
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      results.crypto_random_bytes = {
        success: true,
        hex,
        length: hex.length,
      };
    } catch (e) {
      results.crypto_random_bytes = { success: false, error: e.message };
    }

    // Test 3: crypto.randomUUID() uniqueness (generate 5)
    try {
      const uuids = [];
      for (let i = 0; i < 5; i++) {
        uuids.push(crypto.randomUUID());
      }
      const unique = new Set(uuids).size === uuids.length;
      results.uuid_uniqueness = {
        success: true,
        count: uuids.length,
        all_unique: unique,
        samples: uuids.slice(0, 3),
      };
    } catch (e) {
      results.uuid_uniqueness = { success: false, error: e.message };
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});