export const getCurrentTimeDef = {
  type: "function",
  function: {
    name: "get_current_time",
    description: "Obtém a data e hora atual do sistema local. Útil para responder perguntas sobre o momento atual.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

export async function executeGetCurrentTime() {
  return new Date().toLocaleString('pt-BR');
}
