import { AnalysisDefinition } from './analysisCatalog';

export type AnalysisIcon = { name: string; svgstr: string };

export function iconForAnalysis(
  definition: AnalysisDefinition,
  index: number
): AnalysisIcon {
  const radius = 2 + (index % 3);
  const offset = 3 + (index % 5);
  const path = [
    `M4 ${19 - offset}h3v${offset}H4v-${offset}Z`,
    `M10 ${16 - radius}h4v${radius + 4}h-4v-${radius + 4}Z`,
    `M17 ${13 - offset}h3v${offset + 7}h-3v-${offset + 7}Z`
  ].join('');
  return {
    name: `amphi-ai24-${definition.id}-icon`,
    svgstr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="${path}"/><text x="12" y="7" text-anchor="middle" font-size="4" font-weight="700" fill="currentColor">${definition.iconLabel}</text></svg>`
  };
}
