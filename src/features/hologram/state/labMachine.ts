import type { ImageAsset, LesionSpec, OrganType, Stage } from '../types';

export interface LabState {
  stage: Stage;
  organ: OrganType;
  runId: number;
  asset: ImageAsset | null;
  lesions: LesionSpec[];
  discoveredIds: string[];
  selectedLesionId: string | null;
  selectedPartId: string | null;
  clip: number;
  explode: number;
  completed: boolean;
}
export type LabAction =
  | { type: 'LOAD'; asset: ImageAsset; lesions: LesionSpec[] }
  | { type: 'ADVANCE'; next: 2 | 3 | 4; runId: number }
  | { type: 'DISSECT' }
  | { type: 'SKIP'; runId: number }
  | { type: 'RESET' }
  | { type: 'ORGAN'; organ: OrganType }
  | { type: 'ANATOMY'; key: 'clip' | 'explode'; value: number }
  | { type: 'SELECT_PART'; id: string | null }
  | { type: 'SELECT_LESION'; id: string }
  | { type: 'DISCOVER'; id: string; exposed: boolean; runId: number };

export function createLabState(organ: OrganType = 'lungs', runId = 0): LabState {
  return { stage: 0, organ, runId, asset: null, lesions: [], discoveredIds: [], selectedLesionId: null, selectedPartId: null, clip: 0, explode: 0, completed: false };
}
export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'ORGAN':
      return state.stage === 0 ? { ...state, organ: action.organ } : state;
    case 'ANATOMY':
      return state.stage === 5 && Number.isFinite(action.value) ? { ...state, [action.key]: Math.max(0, Math.min(1, action.value)) } : state;
    case 'SELECT_PART':
      return state.stage >= 4 ? { ...state, selectedPartId: action.id } : state;
    case 'SELECT_LESION':
      return state.discoveredIds.includes(action.id) ? { ...state, selectedLesionId: action.id } : state;
    case 'LOAD':
      return state.stage === 0 ? { ...state, stage: 1, asset: action.asset, lesions: action.lesions, runId: state.runId + 1 } : state;
    case 'ADVANCE':
      return action.runId === state.runId && action.next === state.stage + 1 && state.stage >= 1 && state.stage <= 3
        ? { ...state, stage: action.next } : state;
    case 'DISCOVER': {
      if (state.stage !== 5 || action.runId !== state.runId || !action.exposed || state.discoveredIds.includes(action.id) || !state.lesions.some(item => item.id === action.id)) return state;
      const discoveredIds = [...state.discoveredIds, action.id];
      return { ...state, discoveredIds, selectedLesionId: action.id, completed: discoveredIds.length === state.lesions.length };
    }
    case 'RESET':
      return createLabState(state.organ, state.runId + 1);
    case 'SKIP': {
      if (action.runId !== state.runId || state.stage < 1 || state.stage > 3) return state;
      let next = state;
      // Fast-forward the same ordered transitions; never create discoveries.
      while (next.stage < 4) next = labReducer(next, { type: 'ADVANCE', next: (next.stage + 1) as 2 | 3 | 4, runId: state.runId });
      return next;
    }
    case 'DISSECT':
      return state.stage === 4 ? { ...state, stage: 5 } : state;
    default:
      return state;
  }
}
