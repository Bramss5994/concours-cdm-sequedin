require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if(!url||!key){ console.error("Missing env vars for Supabase (VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY)"); process.exit(2); }
const supabase = createClient(url,key);
(async ()=>{
  try {
    const { data,error } = await supabase.from('matches').select("id,kickoff_at,stadium,team_a:teams!matches_team_a_id_fkey(code,name),team_b:teams!matches_team_b_id_fkey(code,name)").limit(5);
    if (error) { console.error('RPC ERROR', error); process.exit(1); }
    console.log(JSON.stringify(data,null,2));
  } catch (e) { console.error('EX', e); process.exit(1); }
})();
