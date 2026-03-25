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
    id: string;
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
      if (!customId?.startsWith('seen_company:')) {
        return Response.json({ type: PONG });
      }

      const companyId = customId.slice('seen_company:'.length);
      const messageId = interaction.message?.id;

      // Mark all jobs for this company in this message as seen
      if (messageId) {
        await executeSQL(
          env.TURSO_DATABASE_URL,
          env.TURSO_AUTH_TOKEN,
          "UPDATE jobs SET seen_at = datetime('now') WHERE company_id = ? AND discord_message_id = ? AND seen_at IS NULL",
          [companyId, messageId],
        );
      }

      const embeds = interaction.message?.embeds ?? [];
      const components = interaction.message?.components ?? [];

      // Remove the clicked button
      let companyName = '';
      const updatedComponents = components
        .map((row) => ({
          ...row,
          components: row.components.filter((btn) => {
            if (btn.custom_id === customId) {
              // Extract company name: "👁 CompanyName" → "CompanyName"
              companyName = btn.label.replace(/^👁\s*/, '');
              return false;
            }
            return true;
          }),
        }))
        .filter((row) => row.components.length > 0);

      // Prefix matching embed fields with ✅
      // Company-specific embeds: title matches company name, prefix all fields
      // Misc "New Job Matches" embed: fields are "Company — Title", prefix those starting with company name
      const updatedEmbeds = embeds.map((embed) => {
        if (embed.title === companyName) {
          // Company-specific embed — mark all fields
          return {
            ...embed,
            fields: embed.fields?.map((field) =>
              field.name.startsWith('✅') ? field : { ...field, name: `✅ ${field.name}` },
            ),
          };
        }
        // Misc embed — mark fields that start with "CompanyName — "
        const prefix = `${companyName} — `;
        return {
          ...embed,
          fields: embed.fields?.map((field) => {
            if (field.name.startsWith(prefix) && !field.name.startsWith('✅')) {
              return { ...field, name: `✅ ${field.name}` };
            }
            return field;
          }),
        };
      });

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
