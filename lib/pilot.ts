export const RULES = { metresPerPoint: 50, waterPoints: 60, monthlyWaterLimit: 4, reservationMinutes: 15 } as const;
export type RecordedPosition = { lon: number; lat: number; time: number; accuracy: number; segment?: number };
export type PilotState = {
  wallet: { points: number; reserved: number };
  routes: { id: string; name: string; node_ids: string; settings: string; distance: number; shared: number; created_at: string }[];
  activities: { id: string; source: string; distance: number; duration: number; points: number; created_at: string }[];
  redemptions: { id: string; cost: number; token: string; status: string; expires_at: string; created_at: string }[];
  events: { id: string; delta: number; kind: string; created_at: string }[];
  consent: boolean;
  rules: typeof RULES;
};
export const EMPTY_STATE: PilotState = { wallet: { points: 0, reserved: 0 }, routes: [], activities: [], redemptions: [], events: [], consent: false, rules: RULES };
