import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
export async function prompt(label: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(label); } finally { rl.close(); }
}
export async function secretPrompt(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Secret provisioning requires an interactive terminal');
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => { process.stdin.off('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const onKey = (text: string | undefined, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') { cleanup(); reject(new Error('Cancelled')); }
      else if (key.name === 'return' || key.name === 'enter') { cleanup(); resolve(value); }
      else if (key.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key.ctrl && value.length < 257) value += text;
    };
    process.stdin.on('keypress', onKey);
  });
}
