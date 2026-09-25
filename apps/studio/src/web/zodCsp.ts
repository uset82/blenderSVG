import { z } from "zod";

// Zod compiles object schemas with new Function. The web CSP treats that as eval
// and reports it even when the probe is caught. Set this before any schema is built.
z.config({ jitless: true });
