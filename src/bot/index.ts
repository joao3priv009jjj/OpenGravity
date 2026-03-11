import { Bot } from 'grammy';
import { processUserMessage } from '../agent/index.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token || token === "SUTITUYE POR EL TUYO" || token === "") {
  throw new Error("TELEGRAM_BOT_TOKEN não foi configurado. Configure-o no arquivo .env");
}

export const bot = new Bot(token);

// Middleware de segurança (Whitelist)
const allowedUserIdsRaw = process.env.TELEGRAM_ALLOWED_USER_IDS || '';
const allowedUserIds = allowedUserIdsRaw.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

if (allowedUserIds.length === 0) {
  console.warn("⚠️ AVISO DE SEGURANÇA: TELEGRAM_ALLOWED_USER_IDS não está configurado. Recomenda-se adicionar seu User ID.");
}

bot.use(async (ctx, next) => {
  if (!ctx.from) return;

  const userId = ctx.from.id;

  // Se a lista de permitidos estiver configurada e o usuário não estiver nela, bloqueamos!
  if (allowedUserIds.length > 0 && !allowedUserIds.includes(userId)) {
    console.warn(`[Segurança] Usuário bloqueado tentou se comunicar: ID ${userId}`);
    return; // Ignora o usuário
  }

  await next();
});

// Resposta a comandos /start
bot.command('start', async (ctx) => {
  await ctx.reply("Bem-vindo(a) ao OpenGravity! Seu Agente Local seguro já está online. Como posso ajudar?");
});

// Tratamento de mensagens de texto globais
bot.on('message:text', async (ctx) => {
  const chatId = ctx.from.id;
  const userText = ctx.message.text;

  // Para mostrar status "digitando..."
  await ctx.replyWithChatAction('typing');

  try {
    console.log(`[Bot] Recebeu mensagem de ${chatId}: ${userText}`);
    const replyText = await processUserMessage(chatId, userText);
    console.log(`[Bot] Enviando resposta para ${chatId}`);
    await ctx.reply(replyText, { parse_mode: 'HTML' });
  } catch (error: any) {
    console.error("[Bot] Erro ao responder:", error);
    await ctx.reply("Houve uma falha interna ao processar sua solicitação.");
  }
});

// Tratamento generalizado de erros
bot.catch((err) => {
  console.error('[Bot] Ocorreu um erro grammy:', err);
});

