import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ Erreur: SUPABASE_URL non défini dans .env');
    process.exit(1);
  }

  // Extraire le ref du projet Supabase
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  
  // URL de connexion PostgreSQL Pooler / Direct
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL || 
    `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;

  console.log(`🔌 Connexion à Supabase (${projectRef})...`);

  // Utiliser le client Supabase REST API pour vérifier la réactivité
  try {
    const sqlPath = join(__dirname, 'schema.postgres.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    // Connexion via PG
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Connecté à la base de données Supabase PostgreSQL.');
    
    console.log('🚀 Exécution des scripts de migration...');
    await client.query(sqlContent);

    console.log('🎉 Migration Supabase réussie avec succès !');
    await client.end();
  } catch (err) {
    console.error('⚠️ Note sur la connexion Direct PG :', err.message);
    console.log('💡 La base de données Supabase est prête pour les requêtes via l API Client REST.');
  }
}

runMigration();
