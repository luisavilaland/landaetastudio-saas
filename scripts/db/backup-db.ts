import postgres from 'postgres';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { join } from 'path';

config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 30 });

/**
 * Crea un dump SQL de las tablas públicas.
 *
 * Uso: pnpm tsx scripts/db/backup-db.ts [prefix]
 * Si no se pasa prefix, usa "backup".
 * Ejemplo: pnpm tsx scripts/db/backup-db.ts pre-migration
 */
async function backup() {
  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log('Tables:', tables.map(t => t.table_name));
    let dump = '';
    for (const t of tables) {
      const name = t.table_name;
      const data = await sql.unsafe(`SELECT * FROM "${name}"`);
      dump += `-- Table: ${name}\n`;
      if (data.length > 0) {
        const cols = Object.keys(data[0]).join(', ');
        for (const row of data) {
          const vals = Object.values(row).map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`).join(', ');
          dump += `INSERT INTO ${name} (${cols}) VALUES (${vals});\n`;
        }
      }
    }
    const prefix = process.argv[2] || 'backup'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${prefix}-${timestamp}.sql`
    writeFileSync(filename, dump);
    console.log('Backup saved to:', filename);
    console.log('Size:', dump.length, 'bytes');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await sql.end();
  }
}

backup();