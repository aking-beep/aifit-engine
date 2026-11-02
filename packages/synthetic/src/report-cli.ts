import { runSuite, formatReport } from './report.js';

const s = runSuite();
console.log(process.argv.includes('--json') ? JSON.stringify(s, null, 2) : formatReport(s));
process.exitCode = s.invariantFailures || s.unexplained ? 1 : 0;
