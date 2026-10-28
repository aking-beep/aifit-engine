// A stand-in for the Anthropic Messages API, for the "agents on" e2e server.
// It returns fixed, schema-shaped replies so the real SDK, harness and checks
// run end to end without calling a model. It says nothing about model quality.
import { createServer } from 'node:http';

const requests = [];
const port = Number(process.env.STUB_PORT ?? 3019);

function reply(body) {
  const system = Array.isArray(body.system) ? body.system.map((b) => b.text).join('\n') : String(body.system ?? '');
  const user = String(body.messages?.[0]?.content ?? '');
  if (system.includes('suggest answers to the form')) {
    const desc = (user.split('<description>\n')[1] ?? '').split('\n</description>')[0] ?? '';
    return {
      suggestions: [
        { field: 'workTypes', value: 'summarize', evidence: desc.slice(0, 40), confidence: 'medium' },
        { field: 'dataClasses', value: 'phi', evidence: 'patient medical records', confidence: 'high' },
      ],
      questions: ['Who reviews the routing today?'],
    };
  }
  return { summary: 'This follows from the fixed rules applied to your answers.', keyPoints: ['Nothing here changes the decision.'] };
}

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return res.end('ok');
  if (req.method === 'GET' && req.url === '/__requests') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(requests));
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    requests.push({ path: req.url, beta: req.headers['anthropic-beta'] ?? null, body });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      id: `msg_stub_${requests.length}`,
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [{ type: 'text', text: JSON.stringify(reply(body)) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
  });
}).listen(port, '127.0.0.1');
