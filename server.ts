import express from 'express';
import path from 'path';
import { createAppContext } from './src/app-context';
import { createApiRouter } from './src/api';

const ctx = createAppContext();

const validation = ctx.validateServerCore();
if (!validation.valid) {
  console.warn(`\x1b[33mWARNING: ${validation.error}\x1b[0m`);
  console.warn('\x1b[33mThe dashboard will start, but server controls will fail until the server-core directory is set up.\x1b[0m');
}

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', createApiRouter(ctx));

app.get('*', (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const { port } = ctx.getConfig();

app.listen(port, () => {
  const paths = ctx.getPaths();
  console.log(`\n  Bedrock Server Manager`);
  console.log(`  ─────────────────────`);
  console.log(`  Dashboard:  http://localhost:${port}`);
  console.log(`  Server:     ${paths.serverCore}`);
  console.log(`  Backups:    ${paths.backups}`);
  console.log(`  Drop:       ${paths.updateDrop}`);
  console.log();
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31mERROR: Port ${port} is already in use. Change the port in manager-config.json\x1b[0m`);
    process.exit(1);
  }
  throw err;
});
