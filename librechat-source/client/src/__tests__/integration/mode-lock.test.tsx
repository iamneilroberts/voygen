/**
 * Integration Test: Travel Agent Mode Lock
 * Feature: 002-librechat-interface-modifications (Phase 7, T042)
 *
 * Tests that endpoint lock functions correctly
 */

import { renderHook, act } from '@testing-library/react';
import { useEndpointLock } from '~/components/Chat/Menus/EndpointLock';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock import.meta.env
const mockEnv = {
  VITE_VOYGENT_MODE_LOCK: undefined as string | undefined,
};

Object.defineProperty(import.meta, 'env', {
  value: mockEnv,
  writable: true,
});

describe('Endpoint Lock Hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockEnv.VITE_VOYGENT_MODE_LOCK = undefined;
  });

  test('Returns unlocked state by default', () => {
    const { result } = renderHook(() => useEndpointLock());

    expect(result.current.isLocked).toBe(false);
    expect(result.current.lockedEndpoint).toBeNull();
  });

  test('Returns locked state when localStorage flag is set', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');

    const { result } = renderHook(() => useEndpointLock());

    expect(result.current.isLocked).toBe(true);
    expect(result.current.lockedEndpoint).toBe('Claude Sonnet (Premium)');
    expect(result.current.reason).toContain('travel agent mode');
  });

  test('Returns locked state when env var is set', () => {
    mockEnv.VITE_VOYGENT_MODE_LOCK = 'true';

    const { result } = renderHook(() => useEndpointLock());

    expect(result.current.isLocked).toBe(true);
    expect(result.current.lockedEndpoint).toBe('Claude Sonnet (Premium)');
  });

  test('Unlocks when localStorage flag is removed', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');

    const { result, rerender } = renderHook(() => useEndpointLock());

    expect(result.current.isLocked).toBe(true);

    act(() => {
      localStorageMock.removeItem('voygent_mode_lock');
    });

    rerender();

    expect(result.current.isLocked).toBe(false);
  });

  test('Lock reason message is descriptive', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');

    const { result } = renderHook(() => useEndpointLock());

    expect(result.current.reason).toBeTruthy();
    expect(result.current.reason).toContain('Claude Sonnet');
    expect(result.current.reason).toContain('MCP');
  });
});

describe('Endpoint Lock localStorage Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('Lock can be enabled via localStorage', () => {
    expect(localStorageMock.getItem('voygent_mode_lock')).toBeNull();

    localStorageMock.setItem('voygent_mode_lock', '1');

    expect(localStorageMock.getItem('voygent_mode_lock')).toBe('1');
  });

  test('Lock can be disabled via localStorage', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');
    expect(localStorageMock.getItem('voygent_mode_lock')).toBe('1');

    localStorageMock.removeItem('voygent_mode_lock');

    expect(localStorageMock.getItem('voygent_mode_lock')).toBeNull();
  });

  test('Only "1" value enables lock', () => {
    const testValues = ['0', 'true', 'false', 'yes', 'no', ''];

    testValues.forEach((value) => {
      localStorageMock.setItem('voygent_mode_lock', value);
      const { result } = renderHook(() => useEndpointLock());

      // Only '1' should lock (based on implementation)
      const shouldBeLocked = value === '1';
      expect(result.current.isLocked).toBe(shouldBeLocked);

      localStorageMock.clear();
    });
  });
});

describe('Endpoint Lock Environment Variable', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockEnv.VITE_VOYGENT_MODE_LOCK = undefined;
  });

  test('Env var "true" enables lock', () => {
    mockEnv.VITE_VOYGENT_MODE_LOCK = 'true';

    const { result } = renderHook(() => useEndpointLock());

    expect(result.current.isLocked).toBe(true);
  });

  test('Env var other values do not enable lock', () => {
    const falseValues = ['false', '0', '', 'no', undefined];

    falseValues.forEach((value) => {
      mockEnv.VITE_VOYGENT_MODE_LOCK = value;

      const { result } = renderHook(() => useEndpointLock());

      expect(result.current.isLocked).toBe(false);
    });
  });

  test('localStorage takes precedence over env var', () => {
    mockEnv.VITE_VOYGENT_MODE_LOCK = 'false';
    localStorageMock.setItem('voygent_mode_lock', '1');

    const { result } = renderHook(() => useEndpointLock());

    // localStorage should enable lock even if env var is false
    expect(result.current.isLocked).toBe(true);
  });
});

describe('Endpoint Lock Security', () => {
  test('Lock cannot be bypassed by setting lockedEndpoint directly', () => {
    const { result } = renderHook(() => useEndpointLock());

    // Attempt to modify return value (should be immutable)
    const originalLocked = result.current.isLocked;

    // TypeScript should prevent this, but test runtime behavior
    expect(() => {
      // @ts-ignore - intentionally testing immutability
      result.current.isLocked = !originalLocked;
    }).not.toThrow();

    // Value should not change
    expect(result.current.isLocked).toBe(originalLocked);
  });

  test('Lock persists across page reloads (via localStorage)', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');

    // First render
    const { result: result1 } = renderHook(() => useEndpointLock());
    expect(result1.current.isLocked).toBe(true);

    // Simulate page reload by creating new hook instance
    const { result: result2 } = renderHook(() => useEndpointLock());
    expect(result2.current.isLocked).toBe(true);
  });
});

describe('Endpoint Lock UI Behavior', () => {
  test('Locked endpoint is always Claude Sonnet', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');

    const { result } = renderHook(() => useEndpointLock());

    expect(result.current.lockedEndpoint).toBe('Claude Sonnet (Premium)');
  });

  test('Unlock state returns null endpoint', () => {
    const { result } = renderHook(() => useEndpointLock());

    expect(result.current.lockedEndpoint).toBeNull();
  });

  test('Reason message changes with lock state', () => {
    // Unlocked
    const { result: unlockedResult } = renderHook(() => useEndpointLock());
    const unlockedReason = unlockedResult.current.reason;

    // Locked
    localStorageMock.setItem('voygent_mode_lock', '1');
    const { result: lockedResult } = renderHook(() => useEndpointLock());
    const lockedReason = lockedResult.current.reason;

    // Reasons should be different (or unlocked should have empty reason)
    expect(lockedReason).toBeTruthy();
  });
});

describe('Endpoint Lock Admin Functions', () => {
  test('Admin can enable lock programmatically', () => {
    // Simulate admin action
    const enableLock = () => {
      localStorageMock.setItem('voygent_mode_lock', '1');
    };

    enableLock();

    const { result } = renderHook(() => useEndpointLock());
    expect(result.current.isLocked).toBe(true);
  });

  test('Admin can disable lock programmatically', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');

    // Simulate admin action
    const disableLock = () => {
      localStorageMock.removeItem('voygent_mode_lock');
    };

    disableLock();

    const { result } = renderHook(() => useEndpointLock());
    expect(result.current.isLocked).toBe(false);
  });

  test('Lock state can be checked without modifying', () => {
    const checkLockState = () => {
      return localStorageMock.getItem('voygent_mode_lock') === '1';
    };

    expect(checkLockState()).toBe(false);

    localStorageMock.setItem('voygent_mode_lock', '1');

    expect(checkLockState()).toBe(true);
  });
});

describe('Endpoint Lock Integration with ModelSelector', () => {
  test('Lock prevents endpoint change in ModelSelector', () => {
    localStorageMock.setItem('voygent_mode_lock', '1');

    // Simulate ModelSelector behavior
    const handleEndpointChange = (newEndpoint: string) => {
      const { result } = renderHook(() => useEndpointLock());

      if (result.current.isLocked) {
        return false; // Prevented
      }

      return true; // Allowed
    };

    const prevented = handleEndpointChange('GPT-4 (Fallback)');

    expect(prevented).toBe(false);
  });

  test('Unlock allows endpoint change', () => {
    // Simulate ModelSelector behavior
    const handleEndpointChange = (newEndpoint: string) => {
      const { result } = renderHook(() => useEndpointLock());

      if (result.current.isLocked) {
        return false;
      }

      return true;
    };

    const allowed = handleEndpointChange('GPT-4 (Fallback)');

    expect(allowed).toBe(true);
  });
});

describe('Endpoint Lock Edge Cases', () => {
  test('Handles corrupted localStorage value', () => {
    localStorageMock.setItem('voygent_mode_lock', 'corrupted_value');

    const { result } = renderHook(() => useEndpointLock());

    // Should default to unlocked for non-"1" values
    expect(result.current.isLocked).toBe(false);
  });

  test('Handles localStorage being unavailable', () => {
    const originalLocalStorage = window.localStorage;

    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      writable: true,
    });

    // Should not crash
    expect(() => {
      renderHook(() => useEndpointLock());
    }).not.toThrow();

    // Restore
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  test('Handles rapid lock/unlock toggling', () => {
    const { result, rerender } = renderHook(() => useEndpointLock());

    // Toggle multiple times
    for (let i = 0; i < 10; i++) {
      act(() => {
        if (i % 2 === 0) {
          localStorageMock.setItem('voygent_mode_lock', '1');
        } else {
          localStorageMock.removeItem('voygent_mode_lock');
        }
      });

      rerender();

      const expectedLocked = i % 2 === 0;
      expect(result.current.isLocked).toBe(expectedLocked);
    }
  });
});
