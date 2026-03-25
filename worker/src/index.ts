import { verifyKey } from 'discord-interactions';
import { executeSQL } from './turso.js';

interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

interface DiscordInteraction {
  type: number;
  data?: {
    custom_id?: string;
    component_type?: number;
  };
  message?: {
    embeds: Array<{
      title?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: { text: string };
    }>;
    components: Array<{
      type: number;
      components: Array<{
        type: number;
        style: number;
        label: string;
        custom_id: string;
        disabled?: boolean;
      }>;
    }>;
  };
}

// Interaction types
const PING = 1;
const MESSAGE_COMPONENT = 3;

// Response types
const PONG = 1;
const UPDATE_MESSAGE = 7;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify Discord signature
    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    const body = await request.text();

    if (!signature || !timestamp) {
      return new Response('Missing signature headers', { status: 401 });
    }

    const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    const interaction = JSON.parse(body) as DiscordInteraction;

    // Handle PING (Discord endpoint verification)
    if (interaction.type === PING) {
      return Response.json({ type: PONG });
    }

    // Handle button clicks
    if (interaction.type === MESSAGE_COMPONENT) {
      const customId = interaction.data?.custom_id;
      if (!customId?.startsWith('seen:')) {
        return Response.json({ type: PONG });
      }

      const jobId = customId.slice(5);

      // Update Turso
      await executeSQL(
        env.TURSO_DATABASE_URL,
        env.TURSO_AUTH_TOKEN,
        "UPDATE jobs SET seen_at = datetime('now') WHERE id = ? AND seen_at IS NULL",
        [jobId],
      );

      // Modify the message: add ✅ prefix to matching embed field, disable button
      const embeds = interaction.message?.embeds ?? [];
      const components = interaction.message?.components ?? [];

      // Find and update the matching button, extract its label to find the embed field
      let buttonLabel = '';
      const updatedComponents = components.map((row) => ({
        ...row,
        components: row.components.map((btn) => {
          if (btn.custom_id === customId) {
            buttonLabel = btn.label;
            return {
              ...btn,
              style: 3, // SUCCESS (green)
              label: '✅ Seen',
              disabled: true,
            };
          }
          return btn;
        }),
      }));

      // Find the matching embed field by job title and prefix with ✅
      // The button label is "👁 Company — Title", the field name is either "Title" or "Company — Title"
      const fieldNameFromButton = buttonLabel.replace(/^👁\s*/, '');
      const updatedEmbeds = embeds.map((embed) => ({
        ...embed,
        fields: embed.fields?.map((field) => {
          if (field.name === fieldNameFromButton && !field.name.startsWith('✅')) {
            return { ...field, name: `✅ ${field.name}` };
          }
          return field;
        }),
      }));

      return Response.json({
        type: UPDATE_MESSAGE,
        data: {
          embeds: updatedEmbeds,
          components: updatedComponents,
        },
      });
    }

    return Response.json({ type: PONG });
  },
};
