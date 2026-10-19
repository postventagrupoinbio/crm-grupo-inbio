/* ============================================================
   CONFIGURACIÓN — completar con los datos de tu proyecto Supabase
   (Supabase → Project Settings → API → Project URL y anon public key)

   La "anon key" es pública por diseño: la seguridad real la dan
   las reglas del archivo supabase/01_esquema.sql (cada usuario solo
   ve su zona). NUNCA pegues acá la "service_role key".
   ============================================================ */
window.INBIO_CONFIG = {
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU-ANON-KEY',
  // Símbolo que se muestra junto a los montos (tu planilla usa "$")
  MONEDA: '$',
  // Marca de las gráficas "por marca" (en tu planilla: Mindray)
  MARCA_PRINCIPAL: 'Mindray'
};
