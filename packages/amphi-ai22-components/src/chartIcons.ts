import { ChartDefinition } from './chartCatalog';

export type ChartIcon = { name: string; svgstr: string };

export function iconForChart(
  definition: ChartDefinition,
  index: number
): ChartIcon {
  const firstHeight = 4 + (index % 7);
  const secondHeight = 6 + ((index * 3) % 8);
  const thirdHeight = 5 + ((index * 5) % 9);
  const path = [
    `M3 ${20 - firstHeight}h4v${firstHeight}H3v-${firstHeight}Z`,
    `M10 ${20 - secondHeight}h4v${secondHeight}h-4v-${secondHeight}Z`,
    `M17 ${20 - thirdHeight}h4v${thirdHeight}h-4v-${thirdHeight}Z`
  ].join('');
  return {
    name: `amphi-ai22-${definition.id}-icon`,
    svgstr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="${path}"/><text x="12" y="7" text-anchor="middle" font-size="4" font-weight="700" fill="currentColor">${definition.iconLabel}</text></svg>`
  };
}
