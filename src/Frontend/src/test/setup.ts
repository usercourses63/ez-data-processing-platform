import '@testing-library/jest-dom/vitest';

// jsdom does not implement window.matchMedia; Ant Design's responsive observer
// (Grid/Space breakpoints) calls it on mount. Provide a no-op stub so component
// tests rendering antd can mount without throwing.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},      // deprecated
      removeListener: () => {},   // deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom lacks getComputedStyle scrollbar metrics + ResizeObserver used by some
// antd components; stub ResizeObserver if absent.
if (typeof window !== 'undefined' && typeof (window as any).ResizeObserver !== 'function') {
  (window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
