import { uiReducer } from '../uiReducer';
import { GameState, GamePhase } from '../../../types';
import { SafeStorage } from '../../../utils/storageUtils';
import { AppAction } from '../../actionTypes';

// Mock SafeStorage
vi.mock('../../../utils/storageUtils', () => ({
  SafeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('uiReducer', () => {
  const mockState: GameState = {
    // Minimal mock state needed for tests
    phase: GamePhase.PLAYING,
    isDevMenuVisible: false,
    devModelOverride: null,
    // ... add other necessary fields with defaults as needed, or cast to GameState
  } as GameState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle SET_DEV_MODEL_OVERRIDE and persist to storage', () => {
    const action: AppAction = { type: 'SET_DEV_MODEL_OVERRIDE', payload: 'test-model' };
    const newState = uiReducer(mockState, action);

    expect(newState.devModelOverride).toBe('test-model');
    expect(SafeStorage.setItem).toHaveBeenCalledWith('aralia_dev_model_override', 'test-model');
  });

  it('should remove from storage if SET_DEV_MODEL_OVERRIDE payload is null', () => {
    const action: AppAction = { type: 'SET_DEV_MODEL_OVERRIDE', payload: null };
    const newState = uiReducer(mockState, action);

    expect(newState.devModelOverride).toBeNull();
    expect(SafeStorage.removeItem).toHaveBeenCalledWith('aralia_dev_model_override');
  });
});
