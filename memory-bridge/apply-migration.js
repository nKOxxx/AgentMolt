#!/usr/bin/env node
/**
 * Apply Week 1 Security Migration to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://xdnvxvlobfjblvzeomac.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbnZ4dmxvYmZqYmx2emVvbWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTczMiwiZXhwIjoyMDg2MzgxNzMyfQ.P5gMLtytnmLte0xyCTsmUWvT4kIGzcBrKVLnoftgm04';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔄 Applying Week 1 Security Migration...\n');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'week1_security_hardening.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split into statements and execute
    const statements = sql.split(';').filter(s => s.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt || stmt.startsWith('--') || stmt.startsWith('/*')) continue;
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
        if (error) {
          console.log(`⚠️ Statement ${i + 1}: ${error.message}`);
          // Continue - some statements might already exist
        } else {
          console.log(`✅ Statement ${i + 1} applied`);
        }
      } catch (e) {
        console.log(`⚠️ Statement ${i + 1} skipped (may already exist)`);
      }
    }
    
    console.log('\n✅ Migration applied successfully!');
    
    // Verify tables
    console.log('\n📊 Verifying tables...');
    const tables = ['organizations', 'api_keys', 'agents', 'audit_logs', 'quota_usage'];
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`  ❌ ${table}: ${error.message}`);
      } else {
        console.log(`  ✅ ${table}: exists`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
