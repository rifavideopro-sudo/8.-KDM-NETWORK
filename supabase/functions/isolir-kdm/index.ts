const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // 1. Lumpuhkan blokir CORS untuk browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Terima data dari web KDM (app.js)
    const { idPelanggan, aksi } = await req.json();

    // 3. CONTOH EKSEKUSI KE MIKROTIK (Sesuaikan IP, User, Pass)
    
    const ipMikrotik = "id-38.hotsddns.us:11822";
const auth = "Basic " + btoa("admin:admin");
    const url = `http://${ipMikrotik}/rest/system/script/run`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ".id": aksi })
    });
    

    // 4. Kirim jawaban sukses kembali ke web KDM
    return new Response(
      JSON.stringify({ pesan: `Robot Supabase berhasil mengeksekusi: ${aksi}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});