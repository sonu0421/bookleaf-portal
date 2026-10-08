import fs from 'fs';
import mongoose from 'mongoose';

const uri = fs.readFileSync('/tmp/atlas-uri.txt', 'utf8').trim();

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 25000 });
  const db = mongoose.connection.db;
  console.log('Connected, database:', db.databaseName);

  const { databases } = await db.admin().listDatabases();
  console.log(
    'Databases:',
    databases.map((d) => `${d.name} (${(d.sizeOnDisk / 1024).toFixed(1)}KB)`).join(', ')
  );

  const collections = await db.listCollections().toArray();
  console.log('bookleaf collections:', collections.map((c) => c.name).join(', ') || '(empty)');

  await db.dropDatabase();
  console.log('bookleaf dropped (clean slate)');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
