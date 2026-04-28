import { z } from 'zod';

export function registerChatTools(server, state) {
  server.tool(
    'send_chat',
    'Send a message in Minecraft game chat (keep under 100 characters)',
    { message: z.string().max(100).describe('Chat message to send') },
    async ({ message }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      bot.chat(message);
      return text('sent');
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
