// Pass this self-contained function into page.evaluate for cabinet-aware checks.
export function browserDraft(ownerId) {
  const owner = encodeURIComponent(ownerId); const id = localStorage.getItem(`lantern-letter-choice-v1-${owner}`);
  return JSON.parse(localStorage.getItem(!id || id === 'original' ? `lantern-draft-v1-${owner}` : `lantern-letter-v1-${owner}--${id}`));
}
export const readStoredLetter = (page, ownerId) => page.evaluate(browserDraft, ownerId);
export const waitStoredStage = (page, ownerId, stage) => page.waitForFunction(({ ownerId, stage }) => {
  const owner = encodeURIComponent(ownerId); const id = localStorage.getItem(`lantern-letter-choice-v1-${owner}`);
  return JSON.parse(localStorage.getItem(!id || id === 'original' ? `lantern-draft-v1-${owner}` : `lantern-letter-v1-${owner}--${id}`))?.stage === stage;
}, { ownerId, stage });
