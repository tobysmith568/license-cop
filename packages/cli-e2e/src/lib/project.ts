import {
  createProject as createFixtureProject,
  runProcess,
  type Project as FixtureProject,
  type ProcessResult,
  type ProjectOptions
} from "@license-cop/e2e-fixtures";
import { cliBinPath } from "./fixtures";

export interface Project extends FixtureProject {
  runCli: (args?: string[]) => Promise<ProcessResult>;
}

/**
 * A fixture project (see `@license-cop/e2e-fixtures`), plus the ability to run the built CLI binary
 * against it — the one thing about a project that's specific to the CLI rather than the engine.
 */
export const createProject = async (options: ProjectOptions): Promise<Project> => {
  const project = await createFixtureProject(options);

  const runCli = (args: string[] = []) =>
    runProcess("node", [cliBinPath, ...args], { cwd: project.path });

  return { ...project, runCli };
};
