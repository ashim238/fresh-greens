/**
 * Heuristic parser for US auto-insurance card OCR output.
 *
 * On-device OCR returns noisy line arrays; we look for labeled policy
 * numbers first, then fall back to alphanumeric runs. Carrier name is the
 * first substantive line that doesn't look like metadata. User always
 * confirms before save — this is a draft, not ground truth.
 */

export type InsuranceOcrDraft = {
  carrierName?: string;
  policyNumber?: string;
};

const METADATA_RE =
  /policy|member|group|effective|expires|expiration|insured|vehicle|vin|deductible|premium|card|id\s*#/i;

const POLICY_LABEL_RE =
  /(?:policy|pol\.?|member\s*id|subscriber\s*id|id)\s*[#:.]?\s*([A-Z0-9][A-Z0-9\-/.]{5,})/i;

export function parseInsuranceFromOcr(lines: string[]): InsuranceOcrDraft {
  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  if (cleaned.length === 0) return {};

  let policyNumber: string | undefined;
  for (const line of cleaned) {
    const match = line.match(POLICY_LABEL_RE);
    if (match?.[1]) {
      policyNumber = match[1].replace(/\s/g, '');
      break;
    }
  }

  if (!policyNumber) {
    for (const line of cleaned) {
      const match = line.match(/\b([A-Z0-9]{2,}[-\s./]?[A-Z0-9]{4,}[-\s./]?[A-Z0-9]{2,})\b/i);
      if (match?.[1] && match[1].replace(/\D/g, '').length >= 6) {
        policyNumber = match[1].replace(/\s/g, '');
        break;
      }
    }
  }

  const carrierName = cleaned.find(
    (line) => line.length >= 3 && !METADATA_RE.test(line) && line !== policyNumber,
  );

  return {
    carrierName: carrierName?.trim(),
    policyNumber,
  };
}
