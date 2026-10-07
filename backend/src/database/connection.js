import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { DB_PATH, DATA_DIR } from '../config/config.js';

dotenv.config();

try {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.error('Erreur création dossier DATA_DIR:', e);
}

const DEFAULT_SUPABASE_URL = 'https://tbwpxwtjforhfsnpdhlj.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3B4d3RqZm9yaGZzbnBkaGxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE1NjQ3MSwiZXhwIjoyMTA1NzMyNDcxfQ.MJsRI1CboId4ahLQ7dOqpcscTMj1OWq68NYxQBAYB70';

let sqliteDb = null;
let pgPool = null;
let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

    supabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket }
    });
  }
  return supabaseClient;
}

function convertSqlPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

class SupabaseRestAdapter {
  getClient() {
    return getSupabaseClient();
  }

  prepare(sql) {
    const self = this;
    const cleanSql = sql.trim();

    return {
      async all(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const client = self.getClient();

        if (pgPool) {
          try {
            const pgSql = convertSqlPlaceholders(cleanSql);
            const res = await pgPool.query(pgSql, flatParams);
            return res.rows;
          } catch (err) {
            console.warn('⚠️ Erreur PG Pool, passage au fallback REST:', err.message);
          }
        }

        // Requêtes USERS
        if (/FROM\s+users/i.test(cleanSql)) {
          const { data, error } = await client.from('users').select('*, roles(name)').order('created_at', { ascending: false });
          if (error) throw error;
          return (data || []).map(u => ({ ...u, role: u.roles?.name || 'admin' }));
        }

        // Requêtes ROLES
        if (/FROM\s+roles/i.test(cleanSql)) {
          const { data, error } = await client.from('roles').select('*');
          if (error) throw error;
          return data || [];
        }

        // Requêtes PRODUITS
        if (/FROM\s+products/i.test(cleanSql)) {
          let query = client.from('products').select('*, categories(name), suppliers(name)');
          if (/is_active\s*=\s*1/i.test(cleanSql)) query = query.eq('is_active', 1);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []).map(p => ({
            ...p,
            category_name: p.categories?.name || null,
            supplier_name: p.suppliers?.name || null
          }));
        }

        // Fallback générique par nom de table
        const matchTable = /FROM\s+([a_z0-9_]+)/i.exec(cleanSql);
        if (matchTable) {
          const tableName = matchTable[1];
          const { data, error } = await client.from(tableName).select('*');
          if (error) return [];
          return data || [];
        }

        return [];
      },

      async get(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const client = self.getClient();

        if (pgPool) {
          try {
            const pgSql = convertSqlPlaceholders(cleanSql);
            const res = await pgPool.query(pgSql, flatParams);
            return res.rows[0] || null;
          } catch (err) {
            console.warn('⚠️ Erreur PG Pool, passage au fallback REST:', err.message);
          }
        }

        // Recherche d'un utilisateur par username/email (Connexion)
        if (/FROM\s+users/i.test(cleanSql) && (/username\s*=/i.test(cleanSql) || /email\s*=/i.test(cleanSql))) {
          const username = flatParams[0];
          const { data, error } = await client
            .from('users')
            .select('*, roles(name)')
            .eq('username', username)
            .eq('is_active', 1)
            .limit(1)
            .maybeSingle();

          if (error || !data) return null;
          return {
            ...data,
            role: data.roles?.name || 'admin'
          };
        }

        // Recherche d'un utilisateur par ID
        if (/FROM\s+users/i.test(cleanSql) && /id\s*=/i.test(cleanSql)) {
          const id = flatParams[0];
          const { data, error } = await client
            .from('users')
            .select('*, roles(name)')
            .eq('id', id)
            .maybeSingle();
          if (error || !data) return null;
          return {
            ...data,
            role: data.roles?.name || 'admin'
          };
        }

        // Recherche rôle par nom
        if (/FROM\s+roles/i.test(cleanSql) && /name\s*=/i.test(cleanSql)) {
          const name = flatParams[0];
          const { data } = await client.from('roles').select('id').eq('name', name).maybeSingle();
          return data || null;
        }

        // Paramètres de l'entreprise
        if (/FROM\s+business_settings/i.test(cleanSql)) {
          const { data } = await client.from('business_settings').select('*').limit(1).maybeSingle();
          return data || null;
        }

        // Produit par ID ou référence
        if (/FROM\s+products/i.test(cleanSql)) {
          if (/id\s*=/i.test(cleanSql)) {
            const { data } = await client.from('products').select('*, categories(name), suppliers(name)').eq('id', flatParams[0]).maybeSingle();
            if (!data) return null;
            return { ...data, category_name: data.categories?.name, supplier_name: data.suppliers?.name };
          }
          if (/ORDER\s+BY\s+id\s+DESC/i.test(cleanSql)) {
            const { data } = await client.from('products').select('reference').order('id', { ascending: false }).limit(1).maybeSingle();
            return data || null;
          }
        }

        // Fallback générique .get()
        const matchTable = /FROM\s+([a_z0-9_]+)/i.exec(cleanSql);
        if (matchTable) {
          const tableName = matchTable[1];
          const { data } = await client.from(tableName).select('*').limit(1).maybeSingle();
          return data || null;
        }

        return null;
      },

      async run(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const client = self.getClient();

        if (pgPool) {
          try {
            let pgSql = convertSqlPlaceholders(cleanSql);
            if (/^\s*INSERT\s+INTO/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
              pgSql += ' RETURNING id';
            }
            const res = await pgPool.query(pgSql, flatParams);
            return {
              changes: res.rowCount,
              lastInsertRowid: res.rows[0]?.id || null,
            };
          } catch (err) {
            console.warn('⚠️ Erreur PG Pool, passage au fallback REST:', err.message);
          }
        }

        // ── 1. INSERT INTO ──
        const insertMatch = /INSERT\s+INTO\s+([a_z0-9_]+)\s*\(([^)]+)\)/i.exec(cleanSql);
        if (insertMatch) {
          const tableName = insertMatch[1];
          const cols = insertMatch[2].split(',').map((c) => c.trim());
          const record = {};
          cols.forEach((col, idx) => {
            record[col] = flatParams[idx] !== undefined ? flatParams[idx] : null;
          });

          const { data, error } = await client.from(tableName).insert([record]).select('id').maybeSingle();
          if (error) {
            console.error(`Erreur Supabase REST INSERT sur ${tableName}:`, error.message || error);
            throw new Error(error.message || `Erreur d'insertion dans ${tableName}`);
          }
          let insertedId = data?.id;
          if (!insertedId) {
            const { data: lastRow } = await client.from(tableName).select('id').order('id', { ascending: false }).limit(1).maybeSingle();
            insertedId = lastRow?.id || 1;
          }
          return { changes: 1, lastInsertRowid: insertedId };
        }

        // ── 2. UPDATE ──
        const updateMatch = /UPDATE\s+([a_z0-9_]+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i.exec(cleanSql);
        if (updateMatch) {
          const tableName = updateMatch[1];
          const setClause = updateMatch[2];
          const whereClause = updateMatch[3];

          const setCols = setClause.split(',').map((part) => {
            const m = /([a_z0-9_]+)\s*=/i.exec(part.trim());
            return m ? m[1] : null;
          }).filter(Boolean);

          const record = {};
          setCols.forEach((col, idx) => {
            record[col] = flatParams[idx] !== undefined ? flatParams[idx] : null;
          });

          const whereColMatch = /([a_z0-9_]+)\s*=\s*\?/i.exec(whereClause);
          const whereCol = whereColMatch ? whereColMatch[1] : 'id';
          const whereVal = flatParams[setCols.length];

          let query = client.from(tableName).update(record);
          if (whereVal !== undefined) {
            query = query.eq(whereCol, whereVal);
          }

          const { error } = await query;
          if (error) {
            console.error(`Erreur Supabase REST UPDATE sur ${tableName}:`, error.message || error);
            throw new Error(error.message || `Erreur de mise à jour dans ${tableName}`);
          }
          return { changes: 1, lastInsertRowid: whereVal };
        }

        // ── 3. DELETE FROM ──
        const deleteMatch = /DELETE\s+FROM\s+([a_z0-9_]+)\s+WHERE\s+(.+)/i.exec(cleanSql);
        if (deleteMatch) {
          const tableName = deleteMatch[1];
          const whereClause = deleteMatch[2];
          const whereColMatch = /([a_z0-9_]+)\s*=\s*\?/i.exec(whereClause);
          const whereCol = whereColMatch ? whereColMatch[1] : 'id';
          const whereVal = flatParams[0];

          const { error } = await client.from(tableName).delete().eq(whereCol, whereVal);
          if (error) {
            console.error(`Erreur Supabase REST DELETE sur ${tableName}:`, error.message || error);
            throw new Error(error.message || `Erreur de suppression dans ${tableName}`);
          }
          return { changes: 1 };
        }

        return { changes: 1, lastInsertRowid: 1 };
      }
    };
  }

  exec(sql) { return true; }
  pragma() { return true; }
}

class SqliteAdapter {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return {
      all(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.all(...flatParams);
      },
      get(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.get(...flatParams);
      },
      run(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.run(...flatParams);
      },
    };
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  pragma(str) {
    return this.db.pragma(str);
  }
}

export function getDb() {
  const isCloud = Boolean(process.env.VERCEL) || (process.env.USE_CLOUD === 'true');

  if (isCloud) {
    return new SupabaseRestAdapter(getSupabaseClient());
  }

  if (!sqliteDb) {
    try {
      const db = new Database(DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      sqliteDb = db;
    } catch (err) {
      console.error('Erreur ouverture SQLite (fallback :memory:):', err);
      const db = new Database(':memory:');
      db.pragma('foreign_keys = ON');
      sqliteDb = db;
    }
  }

  return new SqliteAdapter(sqliteDb);
}

export function closeDb() {
  if (sqliteDb) {
    try { sqliteDb.close(); } catch {}
    sqliteDb = null;
  }
  if (pgPool) {
    try { pgPool.end(); } catch {}
    pgPool = null;
  }
}

export default getDb;
