import { bot } from './bot/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Exigido para carregamento de env em módulos separados
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log("==========================================");
console.log("🚀 Iniciando o OpenGravity...");
console.log("✅ Conectando base de dados...");
console.log("✅ Inicializando Agent Loop...");
console.log("✅ Inicializando Bot Local do Telegram...");
console.log("==========================================");

bot.start({
  onStart: (botInfo) => {
    console.log(`📡 OpenGravity online! Conectado como @${botInfo.username}`);
  }
});
