// Production entry point (compiles to dist/index.js).
// The Dockerfile runs `node dist/index.js`, so this file must exist at the
// repository root (mirrored from src/ via tsconfig rootDir) and bootstrap the
// backend explicitly (the backend/index.ts auto-start guard only fires when it
// is the main module itself).
import {
  connectToDatabase,
  startListening,
} from "./backend/index";

void connectToDatabase();
startListening();
