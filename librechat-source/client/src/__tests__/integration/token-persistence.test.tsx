/**
 * Integration Test: Token Persistence
 * Feature: 002-librechat-interface-modifications (Phase 7, T041)
 *
 * Tests that token usage persists correctly in localStorage
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecoilState } from 'recoil';
import { voygentLastUsage } from '~/store/voygent';

// Mock fetch for API calls
global.fetch = jest.fn();

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

describe('Token Usage Persistence', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('Token usage is saved to localStorage', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    const mockUsage = {
      conversationId: 'test-conv-123',
      model: 'claude-3-5-sonnet-20241022',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      price: 0.018,
      timestamp: Date.now(),
    };

    act(() => {
      result.current[1](mockUsage);
    });

    await waitFor(() => {
      const stored = localStorageMock.getItem('voygentLastUsage');
      expect(stored).toBeTruthy();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.conversationId).toBe('test-conv-123');
        expect(parsed.model).toBe('claude-3-5-sonnet-20241022');
        expect(parsed.inputTokens).toBe(1000);
        expect(parsed.price).toBe(0.018);
      }
    });
  });

  test('Token usage is loaded from localStorage on init', async () => {
    const mockUsage = {
      conversationId: 'test-conv-456',
      model: 'gpt-4o',
      inputTokens: 2000,
      outputTokens: 1000,
      totalTokens: 3000,
      price: 0.025,
      timestamp: Date.now(),
    };

    localStorageMock.setItem('voygentLastUsage', JSON.stringify(mockUsage));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    await waitFor(() => {
      expect(result.current[0]).toBeTruthy();
      expect(result.current[0]?.conversationId).toBe('test-conv-456');
      expect(result.current[0]?.model).toBe('gpt-4o');
      expect(result.current[0]?.price).toBe(0.025);
    });
  });

  test('Token usage updates replace previous value', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    // First update
    act(() => {
      result.current[1]({
        conversationId: 'conv-1',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        price: 0.002,
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current[0]?.conversationId).toBe('conv-1');
    });

    // Second update
    act(() => {
      result.current[1]({
        conversationId: 'conv-2',
        model: 'gpt-4o',
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        price: 0.003,
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current[0]?.conversationId).toBe('conv-2');
      expect(result.current[0]?.model).toBe('gpt-4o');
    });

    // Verify localStorage only has latest value
    const stored = localStorageMock.getItem('voygentLastUsage');
    expect(stored).toBeTruthy();
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.conversationId).toBe('conv-2');
    }
  });

  test('Clearing token usage removes from localStorage', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    // Set initial value
    act(() => {
      result.current[1]({
        conversationId: 'conv-1',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        price: 0.002,
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(localStorageMock.getItem('voygentLastUsage')).toBeTruthy();
    });

    // Clear value
    act(() => {
      result.current[1](null);
    });

    await waitFor(() => {
      expect(result.current[0]).toBeNull();
      // localStorage should be cleared or set to null
      const stored = localStorageMock.getItem('voygentLastUsage');
      expect(stored === null || stored === 'null').toBe(true);
    });
  });

  test('Invalid localStorage data is handled gracefully', () => {
    localStorageMock.setItem('voygentLastUsage', 'invalid json {');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    // Should not throw error
    expect(() => {
      renderHook(() => useRecoilState(voygentLastUsage), { wrapper });
    }).not.toThrow();
  });

  test('Timestamp is preserved in persistence', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    const timestamp = Date.now();

    act(() => {
      result.current[1]({
        conversationId: 'conv-1',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        price: 0.002,
        timestamp,
      });
    });

    await waitFor(() => {
      const stored = localStorageMock.getItem('voygentLastUsage');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.timestamp).toBe(timestamp);
      }
    });
  });

  test('Price precision is maintained', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    act(() => {
      result.current[1]({
        conversationId: 'conv-1',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 123456,
        outputTokens: 65432,
        totalTokens: 188888,
        price: 0.123456, // 6 decimal places
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current[0]?.price).toBe(0.123456);

      const stored = localStorageMock.getItem('voygentLastUsage');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.price).toBe(0.123456);
      }
    });
  });

  test('Large token counts are preserved', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    const largeTokenCount = 999999999;

    act(() => {
      result.current[1]({
        conversationId: 'conv-1',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: largeTokenCount,
        outputTokens: largeTokenCount,
        totalTokens: largeTokenCount * 2,
        price: 999.99,
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current[0]?.inputTokens).toBe(largeTokenCount);
      expect(result.current[0]?.outputTokens).toBe(largeTokenCount);
    });
  });
});

describe('Token Persistence Edge Cases', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('Handles localStorage quota exceeded gracefully', async () => {
    // Mock localStorage to throw quota exceeded error
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = jest.fn(() => {
      throw new Error('QuotaExceededError');
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    const { result } = renderHook(() => useRecoilState(voygentLastUsage), { wrapper });

    // Should not crash
    expect(() => {
      act(() => {
        result.current[1]({
          conversationId: 'conv-1',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          price: 0.002,
          timestamp: Date.now(),
        });
      });
    }).not.toThrow();

    // Restore original
    localStorageMock.setItem = originalSetItem;
  });

  test('Handles localStorage disabled', () => {
    // Simulate localStorage being disabled
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      writable: true,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot>
        <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
      </RecoilRoot>
    );

    // Should not crash when localStorage is unavailable
    expect(() => {
      renderHook(() => useRecoilState(voygentLastUsage), { wrapper });
    }).not.toThrow();

    // Restore
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });
});
