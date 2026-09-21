#!/usr/bin/env node

import { defaultIo } from "./io";
import { run } from "./main";

// `run` reports every failure itself and resolves to the exit code, so there is nothing to catch
void run(process.argv.slice(2), defaultIo).then(exitCode => {
  process.exitCode = exitCode;
});
