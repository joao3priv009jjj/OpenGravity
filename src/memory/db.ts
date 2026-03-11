import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../../service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

const db = admin.firestore();
const messagesCollection = db.collection('messages');

export interface MessageRow {
  role: string;
  content: string | null;
  tool_calls?: string | null;
  tool_call_id?: string | null;
  name?: string | null;
}

export const memory = {
  async addMessage(chatId: number, msg: MessageRow) {
    await messagesCollection.add({
      chat_id: chatId,
      role: msg.role,
      content: msg.content || null,
      tool_calls: msg.tool_calls || null,
      tool_call_id: msg.tool_call_id || null,
      name: msg.name || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  async getHistory(chatId: number, limit: number = 50): Promise<any[]> {
    const snapshot = await messagesCollection
      .where('chat_id', '==', chatId)
      .orderBy('createdAt', 'asc')
      .limitToLast(limit) // Firebase 9+ supports limitToLast, but we'll fetch limit and rely on desc then reverse, to avoid needing a specific composite index if possible. Actually, to order by createdAt asc and limit to last, we should orderBy desc, limit, then reverse.
      .get();
      
    // Because simple limit() from start might not give the newest,
    // A better approach without composite indexes forcing descending:
    const snapshotDesc = await messagesCollection
      .where('chat_id', '==', chatId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const rows = snapshotDesc.docs.map(doc => doc.data());
    rows.reverse(); // Reverse to get chronological order (asc)
    
    // Converte de volta para o formato esperado pela API Groq/OpenAI
    return rows.map(row => {
      const msg: any = { role: row.role };
      if (row.content !== null && row.content !== undefined) msg.content = row.content;
      if (row.tool_calls) msg.tool_calls = JSON.parse(row.tool_calls);
      if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
      if (row.name) msg.name = row.name;
      return msg;
    });
  },
  
  async clearHistory(chatId: number) {
    const snapshot = await messagesCollection.where('chat_id', '==', chatId).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
};
