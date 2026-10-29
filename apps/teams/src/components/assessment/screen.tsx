import type { Section } from '@aifit/platform';
import { allows, type AssessmentView } from '@/server/assessment-view';
import { ReportPrintStyles } from '@/components/report-footer';
import { AssessmentChrome } from './chrome';
import { LockedSection } from './locked';
import { VerdictSection } from './sections/verdict';
import { BuildVsBuySection } from './sections/build-vs-buy';
import { CostSection } from './sections/cost';
import { RoiSection } from './sections/roi';
import { ArchitectureSection } from './sections/architecture';
import { ModelsSection } from './sections/models';
import { InfrastructureSection } from './sections/infrastructure';
import { GovernanceSection } from './sections/governance';
import { SecuritySection } from './sections/security';
import { RisksSection } from './sections/risks';
import { EvaluationSection } from './sections/evaluation';
import { RoadmapSection } from './sections/roadmap';
import { BlueprintSection } from './sections/blueprint';

const RENDER: Record<Section, (p: { view: AssessmentView }) => React.ReactNode | Promise<React.ReactNode>> = {
  verdict: VerdictSection,
  'build-vs-buy': BuildVsBuySection,
  cost: CostSection,
  roi: RoiSection,
  architecture: ArchitectureSection,
  models: ModelsSection,
  infrastructure: InfrastructureSection,
  governance: GovernanceSection,
  security: SecuritySection,
  risks: RisksSection,
  evaluation: EvaluationSection,
  roadmap: RoadmapSection,
  blueprint: BlueprintSection,
};

/** One assessment section, or the locked panel. A locked section's content is never rendered or sent. */
export async function AssessmentScreen({ view, section }: { view: AssessmentView; section: Section }) {
  // Sections may be async (they read the store); they are awaited here rather than used as JSX.
  const body = allows(view, section) ? await RENDER[section]({ view }) : <LockedSection view={view} section={section} />;
  return (
    <AssessmentChrome view={view} section={section}>
      <ReportPrintStyles />
      {body}
    </AssessmentChrome>
  );
}
