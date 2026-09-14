import { writeFile } from 'node:fs/promises';
import { policies, policyEdition, policyReviewNotice, publisherName } from '../client/src/legal/policies.ts';
for (const [kind, name] of [['terms', '22_TERMS_OF_SERVICE_DRAFT.md'], ['privacy', '23_PRIVACY_POLICY_DRAFT.md']]) {
  const policy = policies[kind];
  await writeFile(new URL('../Documentations/' + name, import.meta.url), `# ${policy.title}\n\n${publisherName} — ${policyEdition}\n\n${policyReviewNotice}\n\n${policy.sections.map(section => `## ${section.title}\n\n${section.text}`).join('\n\n')}\n`);
}
console.log('Review copies prepared from the same policy text shown in the app. No publication performed.');
