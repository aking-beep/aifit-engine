import type { Assessment } from '@aifit/teams-core';

/**
 * The architecture recommendation as a diagram: nodes in left-to-right layers,
 * edges, trust zones. Deterministic from the workload and the assessment, with
 * no figures of its own. The only cost shown is the engine's monthly run cost,
 * on the model node, with that estimate's basis.
 */

export type ArchKind = 'source' | 'gateway' | 'model' | 'store' | 'tool' | 'human' | 'output' | 'guard';
export type ArchZone = 'public' | 'internal' | 'restricted';

export interface ArchGraphNode {
  id: string;
  label: string;
  kind: ArchKind;
  layer: number;
  zone: ArchZone;
  detail: string;
  monthly?: { low: number; high: number; currency: 'USD'; per: 'month' };
  evidence: 'verified' | 'estimated' | 'assumption' | 'recommendation' | 'untested';
}

export interface ArchGraphEdge { from: string; to: string; label?: string; pii?: boolean }

export interface ArchGraph { nodes: ArchGraphNode[]; edges: ArchGraphEdge[]; sensitive: string[] }

const SENSITIVE = new Set(['pii', 'sensitive_pii', 'phi', 'pci', 'financial', 'credentials', 'trade_secret', 'minors']);

const slug = (s: string, i: number) => `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'}-${i}`;

export function architectureGraph(a: Assessment): ArchGraph {
  const w = a.workload;
  const sensitive = w.dataClasses.filter((d) => SENSITIVE.has(d));
  const pii = sensitive.length > 0;
  const modelFree = a.architecture.pattern === 'deterministic-automation' || a.model === null;
  const nodes: ArchGraphNode[] = [];
  const edges: ArchGraphEdge[] = [];
  const outside: ArchZone = w.actor === 'customer' ? 'public' : 'internal';
  const dataZone: ArchZone = pii ? 'restricted' : 'internal';

  // Layer 0: where the work comes from.
  const sources = w.input.sourceSystems.length ? w.input.sourceSystems.slice(0, 4) : [w.actor === 'customer' ? 'Customer request' : w.actor === 'system' ? 'Upstream system' : 'Employee request'];
  const sourceIds = sources.map((s, i) => {
    const id = slug(`src-${s}`, i);
    nodes.push({ id, label: s, kind: 'source', layer: 0, zone: outside, detail: w.input.sourceSystems.length ? 'A system you named as an input.' : 'Who asks for this work.', evidence: 'assumption' });
    return id;
  });

  // Layer 1: a single entry point that authenticates, logs and rate-limits.
  nodes.push({ id: 'gateway', label: modelFree ? 'Service entry point' : 'API gateway', kind: 'gateway', layer: 1, zone: 'internal', detail: 'Authenticates callers, logs every request, enforces rate and spend limits.', evidence: 'recommendation' });
  for (const s of sourceIds) edges.push({ from: s, to: 'gateway', pii });

  let head = 'gateway';
  if (pii && !modelFree) {
    nodes.push({ id: 'redact', label: 'Sensitive-data guard', kind: 'guard', layer: 2, zone: 'restricted', detail: `Redacts or tokenises ${sensitive.join(', ')} before anything reaches a model provider.`, evidence: 'recommendation' });
    edges.push({ from: 'gateway', to: 'redact', pii: true });
    head = 'redact';
  }

  const coreLayer = pii && !modelFree ? 3 : 2;
  const run = a.cost.perMonth;
  const monthly = run.low !== undefined && run.high !== undefined
    ? { low: run.low, high: run.high, currency: 'USD' as const, per: 'month' as const }
    : { low: run.value, high: run.value, currency: 'USD' as const, per: 'month' as const };

  if (modelFree) {
    nodes.push({ id: 'logic', label: 'Rules / service logic', kind: 'tool', layer: coreLayer, zone: dataZone, detail: a.architecture.summary, evidence: 'recommendation' });
    edges.push({ from: head, to: 'logic', pii });
    head = 'logic';
  } else {
    const primary = a.model!.primary;
    if (a.model!.fallbackFast) {
      nodes.push({ id: 'router', label: a.model!.fallbackFast.displayName, kind: 'model', layer: coreLayer, zone: 'internal', detail: 'Handles the easy majority; a confidence threshold sends the rest on.', evidence: 'recommendation' });
      edges.push({ from: head, to: 'router' });
      head = 'router';
    }
    nodes.push({
      id: 'model', label: primary.displayName, kind: 'model', layer: a.model!.fallbackFast ? coreLayer + 1 : coreLayer, zone: 'internal',
      detail: `${a.architecture.label}. Primary model chosen from the dated catalog.`, monthly, evidence: run.basis === 'measured' || run.basis === 'calibrated' ? 'verified' : 'estimated',
    });
    edges.push({ from: head, to: 'model', label: a.model!.fallbackFast ? 'low confidence' : undefined });
    head = 'model';
  }
  const modelLayer = nodes.find((n) => n.id === head)!.layer;

  // Retrieval and tools hang off the core, one layer to the right.
  if (w.input.requiresExternalKnowledge && !modelFree) {
    nodes.push({ id: 'index', label: 'Retrieval index', kind: 'store', layer: modelLayer + 1, zone: dataZone, detail: 'The material answers depend on, indexed for retrieval. Access-controlled like its source.', evidence: 'recommendation' });
    edges.push({ from: head, to: 'index', label: 'retrieve', pii });
  }
  w.actions.slice(0, 4).forEach((act, i) => {
    const id = slug(`tool-${act.system}`, i);
    nodes.push({ id, label: act.system, kind: 'tool', layer: modelLayer + 1, zone: act.write ? 'restricted' : dataZone, detail: `${act.name}${act.write ? ' (writes)' : ' (read-only)'} · ${act.blastRadius}.`, evidence: 'assumption' });
    edges.push({ from: head, to: id, label: act.write ? 'write' : 'read', pii });
  });

  const outLayer = modelLayer + (nodes.some((n) => n.layer === modelLayer + 1) ? 2 : 1);
  let last = head;
  if (w.autonomy === 'suggest' || w.autonomy === 'approve' || a.architecture.pattern === 'hybrid-human-loop') {
    nodes.push({ id: 'human', label: w.autonomy === 'suggest' ? 'Person does the work' : 'Human approval', kind: 'human', layer: outLayer, zone: 'internal', detail: w.autonomy === 'suggest' ? 'Output is a suggestion; a person acts on it.' : 'A person approves each output before it takes effect.', evidence: 'recommendation' });
    edges.push({ from: last, to: 'human', pii });
    last = 'human';
  }
  nodes.push({ id: 'output', label: w.output.mustBeStructured ? 'Structured result' : 'Result', kind: 'output', layer: nodes.find((n) => n.id === last)!.layer + (last === 'human' ? 1 : 1), zone: outside, detail: `Delivered to ${w.actor === 'customer' ? 'the customer' : w.actor === 'system' ? 'the next system' : 'the employee'}.`, evidence: 'assumption' });
  edges.push({ from: last, to: 'output', pii: pii && w.actor === 'customer' });

  return { nodes, edges, sensitive };
}
