import postgres from 'postgres';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';

config({ path: '../../.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 30 });

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
    const filename = `backup-pre-t7-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
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