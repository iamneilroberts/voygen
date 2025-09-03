import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function credPath() {
  return process.env.GOOGLE_CREDENTIALS_PATH || '.secrets/credentials.json';
}
function tokenPath() {
  return process.env.GOOGLE_TOKEN_PATH || '.secrets/token.json';
}

export async function getAuthenticatedClient(): Promise<gmail_v1.Gmail> {
  const credFile = credPath();
  const raw = fs.readFileSync(credFile, 'utf8');
  const credentials = JSON.parse(raw);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Try token
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath(), 'utf8'));
    oAuth2Client.setCredentials(token);
  } catch {
    // No token yet: start local flow
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    // eslint-disable-next-line no-console
    console.log('\nOpen this URL to authorize:', authUrl, '\n');
    throw new Error('OAuth required: run `npm run auth`');
  }

  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

export async function runAuthFlow() {
  const credFile = credPath();
  const raw = fs.readFileSync(credFile, 'utf8');
  const credentials = JSON.parse(raw);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
  console.log('\nAuthorize this app by visiting this url:\n', authUrl, '\n');
  console.log('After granting, paste the `code` query param here and press Enter.');
  const code = await readFromStdin('Code: ');
  const { tokens } = await oAuth2Client.getToken(code.trim());
  fs.mkdirSync(path.dirname(tokenPath()), { recursive: true });
  fs.writeFileSync(tokenPath(), JSON.stringify(tokens));
  console.log('Token stored to', tokenPath());
}

function readFromStdin(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    const chunks: Buffer[] = [];
    process.stdin.on('data', (d) => chunks.push(Buffer.from(d)));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.resume();
  });
}

export type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: gmail_v1.Schema$MessagePart;
  labelIds?: string[];
};

export async function listUnreadPrimary(gmail: gmail_v1.Gmail, maxResults = 50): Promise<GmailMessage[]> {
  const q = 'label:unread -category:social -category:promotions -in:chats -in:spam';
  const res = await gmail.users.messages.list({ userId: 'me', q, maxResults });
  const ids = res.data.messages || [];
  if (!ids.length) return [];
  const items: GmailMessage[] = [];
  for (const m of ids) {
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' });
    items.push(full.data as GmailMessage);
  }
  return items;
}

export function headerValue(msg: GmailMessage, name: string): string | undefined {
  const h = msg.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || undefined;
}

export function bodyHtml(msg: GmailMessage): string | undefined {
  const parts = flattenParts(msg.payload);
  const html = parts.find((p) => p.mimeType === 'text/html')?.body?.data;
  if (!html) return undefined;
  return Buffer.from(html, 'base64').toString('utf8');
}

function flattenParts(part?: gmail_v1.Schema$MessagePart): gmail_v1.Schema$MessagePart[] {
  if (!part) return [];
  const list: gmail_v1.Schema$MessagePart[] = [part];
  if (part.parts) for (const p of part.parts) list.push(...flattenParts(p));
  return list;
}

// CLI entry
if (process.argv[2] === 'auth') {
  runAuthFlow().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

