/**
 * Clean AI response - remove all [REF:...] tags and similar formatting artifacts
 * This is a client-side safety net in case the server doesn't clean properly
 */
export function cleanAIResponse(response: string): string {
  if (!response) return response;
  
  let cleaned = response;
  
  // Remove ALL [REF:...] variations (greedy match to end bracket)
  cleaned = cleaned.replace(/\[REF:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[ref:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[Ref:[^\]]*\]/gi, '');
  
  // Remove any word that starts with [REF (even if malformed)
  cleaned = cleaned.replace(/\[REF\S*/gi, '');
  cleaned = cleaned.replace(/\[ref\S*/gi, '');
  
  // Remove bracketed references like [lifestyle_exercise], [profile_name], etc.
  cleaned = cleaned.replace(/\[[a-z_]+\]/gi, '');
  cleaned = cleaned.replace(/\[[a-z_]+:[^\]]*\]/gi, '');
  
  // Remove parenthetical data references
  cleaned = cleaned.replace(/\(from your profile\)/gi, '');
  cleaned = cleaned.replace(/\(from health data\)/gi, '');
  cleaned = cleaned.replace(/\(from your data\)/gi, '');
  cleaned = cleaned.replace(/\(from conditions\)/gi, '');
  cleaned = cleaned.replace(/\(from medications\)/gi, '');
  cleaned = cleaned.replace(/\(from your goals?\)/gi, '');
  cleaned = cleaned.replace(/\(today's data\)/gi, '');
  cleaned = cleaned.replace(/\(health history\)/gi, '');
  cleaned = cleaned.replace(/\(from Apple Health\)/gi, '');
  cleaned = cleaned.replace(/\(from onboarding\)/gi, '');
  cleaned = cleaned.replace(/\(from your records?\)/gi, '');
  cleaned = cleaned.replace(/\(your [a-z]+ data\)/gi, '');
  
  // Remove "based on/according to" phrases
  cleaned = cleaned.replace(/based on your (profile|data|health data|records|information)/gi, '');
  cleaned = cleaned.replace(/according to your (profile|data|health data|records|information)/gi, '');
  cleaned = cleaned.replace(/as per your (profile|data|health data|records|information)/gi, '');
  
  // Clean up extra whitespace and punctuation issues
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.trim();
  
  return cleaned;
}
