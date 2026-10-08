import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri('bookleaf');
console.log('[local] mongo at', uri);

const server = spawn('node', ['src/index.js'], {
  env: { ...process.env, MONGO_URI: uri, JWT_SECRET: 'local-dev-secret-key-12345', PORT: '5001' },
  stdio: 'inherit',
});

process.on('SIGTERM', () => { server.kill(); mongod.stop(); });
process.on('SIGINT', () => { server.kill(); mongod.stop(); });
