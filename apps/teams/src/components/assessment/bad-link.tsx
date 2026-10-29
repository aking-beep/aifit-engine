import Link from 'next/link';
import { Panel } from '@/design';

export function BadLink() {
  return (
    <Panel className="p-6">
      <h1 className="text-headline-md text-fg">That report link did not resolve</h1>
      <p className="mt-2 text-body-md text-fg-2">
        Reports are not stored: the intake lives in the link itself, so a truncated or edited link cannot be recovered.{' '}
        <Link href="/assess" className="text-accent underline underline-offset-2">Run the assessment again</Link>.
      </p>
    </Panel>
  );
}
