import postgres from 'postgres';
import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

config({ path: '../../.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 30 });

async function main() {
  try {
    const migrationsDir = join(__dirname, '../../packages/db/migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('_snapshot'))
      .sort();
    
    console.log('Found migration files:', files);
    
    for (const file of files) {
      console.log(`\nApplying ${file}...`);
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const statements = content.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
      
      for (const stmt of statements) {
        if (stmt.trim()) {
          try {
            await sql.unsafe(stmt);
            console.log(`  OK: ${stmt.substring(0, 80)}...`);
          } catch (e: any) {
            // Ignore "already exists" errors
            if (e.message?.includes('already exists') || e.message?.includes('duplicate key')) {
              console.log(`  SKIP (exists): ${stmt.substring(0, 80)}...`);
            } else {
              throw e;
            }
          }
        }
      }
    }
    
    // Create __drizzle_migrations table and insert entries
    await sql`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `;
    
    const journalPath = join(migrationsDir, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
    
    for (const entry of journal.entries) {
      await sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        VALUES (${entry.tag}, ${entry.when})
        ON CONFLICT DO NOTHING
      `;
      console.log(`Recorded migration: ${entry.tag}`);
    }
    
    console.log('\nAll migrations applied!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await sql.end();
  }
}

main();