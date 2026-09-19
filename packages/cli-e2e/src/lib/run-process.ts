import * as childProcess from "child_process";

export interface ProcessResult {
  exitCode: number;
  output: string;
}

export const runProcess = (
  command: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string>; shell?: boolean }
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: options.shell ?? false
    });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));

    child.on("error", reject);
    child.on("close", exitCode => resolve({ exitCode: exitCode ?? -1, output }));
  });
