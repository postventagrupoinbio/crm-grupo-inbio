/* ============================================================
   CONFIGURACIÓN — completar con los datos de tu proyecto Supabase
   (Supabase → Project Settings → API → Project URL y anon public key)

   La "anon key" es pública por diseño: la seguridad real la dan
   las reglas del archivo supabase/01_esquema.sql (cada usuario solo
   ve su zona). NUNCA pegues acá la "service_role key".
   ============================================================ */
window.INBIO_CONFIG = {
  SUPABASE_URL: 'https://qilrajkqzzjjswnsqicb.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbHJhamtxenpqanN3bnNxaWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0Mzc5MjgsImV4cCI6MjEwODAxMzkyOH0.FRFBf1ebZRinMLcjJ4TbkEeea7C62orZTegDgIpzdMQ',
  // Símbolo que se muestra junto a los montos (tu planilla usa "$")
  MONEDA: '$',
  // Marca de las gráficas "por marca" (en tu planilla: Mindray)
  MARCA_PRINCIPAL: 'Mindray'
};
