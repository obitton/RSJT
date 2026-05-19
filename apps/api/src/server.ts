import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await buildApp(config);

await app.listen({
  host: config.API_HOST,
  port: config.API_PORT,
});
