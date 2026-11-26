
const limits = {
  signal: 30,
  fit: 30,
  recency: 20,
  evidence: 20
};

export function calculateScore(breakdown) {
  let total = 0;

  for (const [key, maximum] of Object.entries(limits)) {
    const value = breakdown[key];

    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > maximum
    ) {
      throw new Error(`Invalid scoring component: ${key}`);
    }

    total += value;
  }

  return total;
}


export function assessOpportunity(title) {
  if (typeof title !== 'string') return null;

  const rules = [
    {
      pattern: /\b(administrative assistant|administrative coordinator|data entry|office assistant)\b/i,
      fit: 25,
      opportunity: 'Administrative automation'
    },
    {
      pattern: /\b(customer support|customer service)\b/i,
      fit: 20,
      opportunity: 'Customer support automation'
    },
    {
      pattern: /\b(marketing|content)\b/i,
      fit: 15,
      opportunity: 'Marketing automation'
    },
    {
      pattern: /\b(operations|administrator|coordinator|administrative)\b/i,
      fit: 10,
      opportunity: 'Workflow automation'
    }
  ];

  const match = rules.find(
    rule => rule.pattern.test(title)
  );

  return match ? {
    fit: match.fit,
    opportunity: match.opportunity
  } : null;
}

export function assessRelevance(title) {
  return assessOpportunity(title)?.fit ?? 0;
}
