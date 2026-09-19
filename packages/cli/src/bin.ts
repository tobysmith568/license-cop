#!/usr/bin/env node

import { defaultIo } from "./io";
import { run } from "./main";

const main = async () => {
  try {
    const args = process.argv.slice(2);
    process.exitCode = await run(args, defaultIo);
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    defaultIo.stderr(message);
    process.exitCode = 1;
  }
};

void main();
