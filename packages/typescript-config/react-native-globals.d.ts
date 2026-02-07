/**
 * Global type declarations for APIs available in React Native (Hermes)
 * but not included in the ES2020 TypeScript lib.
 */

// Available in Hermes since RN 0.66+
declare function queueMicrotask(callback: () => void): void;

// Available in Hermes (polyfilled by React Native)
declare function atob(data: string): string;
declare function btoa(data: string): string;

// Available in Hermes since RN 0.71+
declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
  readonly encoding: string;
  decode(input?: ArrayBufferView | ArrayBuffer, options?: { stream?: boolean }): string;
}

declare class TextEncoder {
  readonly encoding: string;
  encode(input?: string): Uint8Array;
}
