import dotenv from "dotenv";
// dotenv 17: pass quiet:true to suppress the startup log line.
// Must run before any other import reads process.env.
dotenv.config({ quiet: true });

// Side-effect import: bootstraps the HTTP server
await import("./server");
