import dotenv from "dotenv";
// dotenv 17: pass quiet:true to suppress the startup log line.
// Must run before any other import reads process.env.
dotenv.config({ quiet: true });

const { start } = await import("./server");

start();
