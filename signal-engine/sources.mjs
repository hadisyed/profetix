
export const sources = Object.freeze([
  Object.freeze({
    id: 'greenhouse-stripe',
    provider: 'Greenhouse',
    company: 'Stripe',
    board: 'stripe',
    endpoint: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
    accessType: 'public-api',
    permissionStatus: 'pending',
    enabled: false,
    commercialUseVerified: false,
    approvalReference: null
  })
]);

export function isSourceApproved(source) {
  return Boolean(
    source &&
    source.enabled === true &&
    source.permissionStatus === 'approved' &&
    source.commercialUseVerified === true &&
    typeof source.approvalReference === 'string' &&
    source.approvalReference.trim().length > 0
  );
}

export function getApprovedSources() {
  return sources.filter(isSourceApproved);
}
