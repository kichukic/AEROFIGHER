import { Buffer } from 'buffer';

// Native socket libraries expect a global Buffer (Node-style).
const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (typeof g.Buffer === 'undefined') g.Buffer = Buffer;
