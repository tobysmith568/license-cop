import type { OnVerbose } from "@license-cop/core";

export type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

export const defaultIo: Io = {
  stdout: line => console.log(line),
  stderr: line => console.error(line)
};

export const createVerboseLogger = (io: Io, enabled: boolean): OnVerbose => {
  if (!enabled) {
    return () => {};
  }

  const verbose: OnVerbose = message => io.stdout(message);
  verbose("Verbose logging enabled");

  return verbose;
};
