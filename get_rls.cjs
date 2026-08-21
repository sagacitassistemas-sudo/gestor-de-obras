const { execSync } = require('child_process');
const fs = require('fs');

try {
  const result = execSync('npx supabase db query "SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = \'public\';" --output json', { encoding: 'utf-8' });
  fs.writeFileSync('rls_policies.json', result);
  console.log('Saved to rls_policies.json');
} catch(err) {
  console.error(err.message);
}
