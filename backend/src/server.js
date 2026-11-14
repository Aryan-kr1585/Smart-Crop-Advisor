import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
app.listen(env.PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'api listening', port: env.PORT }));
});
