import { getCurrentTimeDef, executeGetCurrentTime } from './get_current_time.js';

export const toolsDefinition = [
  getCurrentTimeDef
];

// O Agent Loop utilizará este executor para resolver side-effects
export async function executeTool(name: string, args: any) {
  switch (name) {
    case 'get_current_time':
      return await executeGetCurrentTime();
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}
