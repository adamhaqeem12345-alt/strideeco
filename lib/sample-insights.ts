import { CENTRE, coordinatesFor, length, makeRoutes, places, type RouteOption } from './geo';

/** Public path geometry only. Every use count and exposure value below is invented. */
export const SAMPLE_INSIGHTS_NOTICE = 'Sample data only. No real activities, resident records or GPS tracks feed this preview.';

type ReviewExample = {
  id: string;
  label: string;
  route: RouteOption;
  sampleUses: number;
  reviewTitle: string;
  reviewQuestion: string;
  reviewChecks: readonly string[];
};
export type SampleRouteInsight = ReviewExample;
export type SampleSegmentInsight = ReviewExample & { sampleExposure: number; parentLabel: string };

const mappedRoutes = makeRoutes({
  distance: 3, date: '2026-10-26', time: '17:30', origin: places[0]?.coordinate ?? CENTRE,
  scenario: false, height: 6, preference: 'balanced', mode: 'loop',
});

const routeExamples = [
  { label: 'Park route A', sampleUses: 87, reviewTitle: 'Understand why this route draws repeat use',
    reviewQuestion: 'Would a site walk reveal useful connections or comfortable places to pause?',
    reviewChecks: ['Walk the mapped connection and confirm access.', 'Ask pilot participants what makes the route useful.', 'Record one practical question for the township team.'] },
  { label: 'Park route B', sampleUses: 62, reviewTitle: 'Check the experience along the whole route',
    reviewQuestion: 'Are there breaks in the walking experience that deserve a closer look?',
    reviewChecks: ['Confirm the mapped path is usable on the ground.', 'Review crossings and connections during a site visit.', 'Keep observations separate from this sample usage count.'] },
  { label: 'Park route C', sampleUses: 35, reviewTitle: 'Compare a longer outing with a shorter option',
    reviewQuestion: 'What would help residents choose a route that suits their available time?',
    reviewChecks: ['Check the route and any access restrictions.', 'Gather voluntary feedback on route choice.', 'Review the evidence before proposing a change.'] },
] as const;

export const sampleRouteInsights: SampleRouteInsight[] = mappedRoutes.map((route, index) => {
  const example = routeExamples[index];
  return { ...example, id: `sample-route-${index + 1}`, route: { ...route, name: example.label, shade: null } };
});

const segmentExamples = [
  { sampleExposure: 72, sampleUses: 54, reviewTitle: 'Check afternoon cover on site',
    reviewQuestion: 'Does this mapped stretch actually lack usable shade at the times people walk?',
    reviewChecks: ['Visit at the relevant time and record actual cover.', 'Check trees, shelters and nearby route alternatives.', 'Decide whether a fuller shade assessment is warranted.'] },
  { sampleExposure: 64, sampleUses: 38, reviewTitle: 'Compare a more comfortable connection',
    reviewQuestion: 'Could an existing nearby connection offer a practical alternative?',
    reviewChecks: ['Verify the path and nearby connections on the ground.', 'Compare real cover without treating this sample score as evidence.', 'Ask the township team which option deserves study.'] },
  { sampleExposure: 58, sampleUses: 27, reviewTitle: 'Review opportunities for a short rest',
    reviewQuestion: 'Would a rest point help here, or is another improvement more useful?',
    reviewChecks: ['Confirm access and existing places to pause.', 'Consider actual site conditions and participant feedback.', 'Record a review decision before planning any works.'] },
] as const;

export const sampleSegmentInsights: SampleSegmentInsight[] = sampleRouteInsights.map((parent, index) => {
  const count = Math.min(parent.route.nodeIds.length, Math.max(2, Math.ceil(parent.route.nodeIds.length * .18)));
  const start = Math.min(parent.route.nodeIds.length - count, Math.floor(parent.route.nodeIds.length * (.18 + index * .12)));
  const nodeIds = parent.route.nodeIds.slice(start, start + count);
  const coordinates = coordinatesFor(nodeIds);
  const label = `Sample segment ${String.fromCharCode(65 + index)}`;
  return {
    ...segmentExamples[index], id: `sample-segment-${index + 1}`, label, parentLabel: parent.label,
    route: { id: `sample-segment-geometry-${index + 1}`, name: label, nodeIds, coordinates,
      distance: length(coordinates), duration: Math.ceil(length(coordinates) / 75), kind: 'Point to point', shade: null },
  };
});

export const sampleRouteUseTotal = sampleRouteInsights.reduce((total, route) => total + route.sampleUses, 0);
