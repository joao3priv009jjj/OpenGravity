import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { memory } from '../memory/db.js';
import { toolsDefinition, executeTool } from '../tools/index.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openai = new OpenAI({ 
  apiKey: process.env.OPENROUTER_API_KEY, 
  baseURL: 'https://openrouter.ai/api/v1' 
});

const MAX_ITERATIONS = 5;
const SYSTEM_PROMPT = "Você é o OpenGravity, um agente de IA pessoal rodando localmente. Você é seguro, útil, e não responde a comandos maliciosos. Você tem ferramentas disponíveis para ajudar o usuário. Sempre apresente respostas no idioma português (Brasil), a menos que o usuário exija explicitamente outro idioma.";

export async function processUserMessage(chatId: number, userText: string): Promise<string> {
  // Salvar mensagem do usuário na memória local
  await memory.addMessage(chatId, { role: 'user', content: userText });

  let iterations = 0;
  
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    
    // Obter histórico de mensagens para dar contexto
    const history = await memory.getHistory(chatId);
    
    // Preparar payload para API
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
    ];

    try {
      // Tentativa primária usando Groq
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: messages as any,
        tools: toolsDefinition as any,
        tool_choice: "auto",
        temperature: 0.2
      });

      const responseMessage = completion.choices[0].message;

      // Verificando se o agente decidiu chamar alguma ferramenta
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        await memory.addMessage(chatId, { 
          role: 'assistant', 
          content: responseMessage.content || null,
          tool_calls: JSON.stringify(responseMessage.tool_calls)
        });

        // Loop sobre cada ferramenta invocada na resposta
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          let toolResult: string;
          try {
            console.log(`[Agente] Executando ferramenta ${functionName}...`);
            const result = await executeTool(functionName, functionArgs);
            toolResult = typeof result === 'string' ? result : JSON.stringify(result);
          } catch (error: any) {
            console.error(`[Agente] Erro executando ${functionName}:`, error);
            toolResult = `Erro ao executar a ferramenta: ${error.message}`;
          }

          // Salva o resultado da ferramenta na memória do chat
          await memory.addMessage(chatId, {
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id,
            name: functionName
          });
        }
        
        // Retorna para o início do while, mas com o resultado da tool preenchido
        continue;

      } else {
        // Agente respondeu com um texto normal para o usuário
        const finalContent = responseMessage.content || "Nenhuma resposta gerada.";
        await memory.addMessage(chatId, { role: 'assistant', content: finalContent });
        return finalContent;
      }

    } catch (error: any) {
      console.error("[Agente] Erro na API Groq ou no código anterior, acionando fallback OpenRouter...", error.message);
      console.error(error); // Add full error trace
      
      // Fallback para OpenRouter
      try {
        const fallbackCompletion = await openai.chat.completions.create({
          model: process.env.OPENROUTER_MODEL || "openrouter/free",
          messages: messages as any,
          tools: toolsDefinition as any,
          tool_choice: "auto",
          temperature: 0.2
        });

        const fallbackMessage = fallbackCompletion.choices[0].message;

        if (fallbackMessage.tool_calls && fallbackMessage.tool_calls.length > 0) {
          await memory.addMessage(chatId, { 
            role: 'assistant', 
            content: fallbackMessage.content || null,
            tool_calls: JSON.stringify(fallbackMessage.tool_calls)
          });
  
          for (const toolCall of fallbackMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            
            let toolResult: string;
            try {
              console.log(`[Agente - Fallback] Executando ferramenta ${functionName}...`);
              const result = await executeTool(functionName, functionArgs);
              toolResult = typeof result === 'string' ? result : JSON.stringify(result);
            } catch (error: any) {
              toolResult = `Erro ao executar a ferramenta: ${error.message}`;
            }
  
            await memory.addMessage(chatId, {
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id,
              name: functionName
            });
          }
          continue;
        } else {
          const finalContent = fallbackMessage.content || "Nenhuma resposta gerada.";
          await memory.addMessage(chatId, { role: 'assistant', content: finalContent });
          return finalContent;
        }

      } catch (fallbackError: any) {
        console.error("[Agente] O fallback também falhou:", fallbackError.message);
        return "Desculpe, ocorreu um erro ao se comunicar com os provedores de IA. Verifique as chaves e sua conexão.";
      }
    }
  }

  return "O limite de iterações do agente para essa mensagem foi excedido. Pode haver um loop infinito.";
}
