import { dirname, isAbsolute, join, parse, resolve, sep } from "node:path";
import type { FileSystem } from "./file-system";

const maxSymlinkDepth = 40;

/**
 * A `FileSystem` that lives in memory, for a test to build a project in without touching the disk.
 * It follows the same rules `NodeFileSystem` does: a path is a file or a directory but never both,
 * a directory exists wherever something is inside it, and a symlink is followed by every question
 * (so a dangling one is neither a file nor a directory).
 */
export class InMemoryFileSystem implements FileSystem {
  private readonly files = new Map<string, string>();
  private readonly directories = new Set<string>();
  private readonly links = new Map<string, string>();

  /** Adds a file (and the directories above it). Objects are serialized as JSON. */
  addFile(path: string, contents: string | object = ""): void {
    const absolute = resolve(path);
    const serialized = typeof contents === "string" ? contents : JSON.stringify(contents);

    this.addDirectoriesAbove(absolute);
    this.files.set(absolute, serialized);
  }

  addDirectory(path: string): void {
    const absolute = resolve(path);

    this.addDirectoriesAbove(absolute);
    this.directories.add(absolute);
  }

  /** `target` may be relative, in which case it is relative to the link's own directory. */
  addSymlink(linkPath: string, target: string): void {
    const absolute = resolve(linkPath);
    const linkDirectory = dirname(absolute);
    const absoluteTarget = isAbsolute(target) ? target : resolve(linkDirectory, target);

    this.addDirectoriesAbove(absolute);
    this.links.set(absolute, absoluteTarget);
  }

  async fileExists(path: string): Promise<boolean> {
    const resolved = this.resolveLinks(path);

    return await Promise.resolve(resolved !== undefined && this.files.has(resolved));
  }

  async directoryExists(path: string): Promise<boolean> {
    const resolved = this.resolveLinks(path);

    return await Promise.resolve(resolved !== undefined && this.directories.has(resolved));
  }

  async readText(path: string): Promise<string> {
    const resolved = this.resolveLinks(path);
    const contents = resolved === undefined ? undefined : this.files.get(resolved);

    if (contents === undefined) {
      return await Promise.reject(this.noSuchFile(path));
    }

    return contents;
  }

  async realpath(path: string): Promise<string> {
    const resolved = this.resolveLinks(path);

    if (resolved === undefined || !this.exists(resolved)) {
      return await Promise.reject(this.noSuchFile(path));
    }

    return resolved;
  }

  private resolveLinks(path: string): string | undefined {
    const absolute = resolve(path);

    return this.followLinks(absolute);
  }

  private exists(resolvedPath: string): boolean {
    return this.files.has(resolvedPath) || this.directories.has(resolvedPath);
  }

  /**
   * Resolves every symlink along the path, in any of its segments, the way the OS does. Undefined
   * for a loop of links.
   */
  private followLinks(absolutePath: string, depth = 0): string | undefined {
    if (depth > maxSymlinkDepth) {
      return undefined;
    }

    const { root } = parse(absolutePath);
    const segments = absolutePath.slice(root.length).split(sep).filter(Boolean);

    let current = root;
    for (const segment of segments) {
      current = join(current, segment);

      const target = this.links.get(current);
      if (target !== undefined) {
        const followed = this.followLinks(target, depth + 1);
        if (followed === undefined) {
          return undefined;
        }

        current = followed;
      }
    }

    return current;
  }

  private addDirectoriesAbove(absolutePath: string): void {
    let directory = dirname(absolutePath);

    while (!this.directories.has(directory)) {
      this.directories.add(directory);

      const parent = dirname(directory);
      if (parent === directory) {
        break;
      }

      directory = parent;
    }
  }

  private noSuchFile(path: string): Error {
    const error = new Error(`ENOENT: no such file or directory, '${path}'`);

    return Object.assign(error, { code: "ENOENT" });
  }
}

/** Where a test's project lives in memory; it never has to exist on a real disk. */
export const memoryRoot = resolve(sep, "project");

export type MemoryDir = {
  path: string;
  fileSystem: InMemoryFileSystem;
  /** Writes files relative to the dir. Objects are serialized as JSON. */
  write: (files: Record<string, string | object>) => void;
  mkdir: (relativePath: string) => void;
  /** `target` is relative to the dir, unless absolute. */
  symlink: (relativeLinkPath: string, target: string) => void;
};

/** The in-memory counterpart of `createTempDir`: the same `write`, over a fresh `FileSystem`. */
export const createMemoryDir = (path = memoryRoot): MemoryDir => {
  const fileSystem = new InMemoryFileSystem();

  fileSystem.addDirectory(path);

  const write = (files: Record<string, string | object>) => {
    for (const [relativePath, contents] of Object.entries(files)) {
      const fullPath = join(path, relativePath);

      fileSystem.addFile(fullPath, contents);
    }
  };

  const mkdir = (relativePath: string) => {
    const fullPath = join(path, relativePath);

    fileSystem.addDirectory(fullPath);
  };

  const symlink = (relativeLinkPath: string, target: string) => {
    const linkPath = join(path, relativeLinkPath);
    const targetPath = isAbsolute(target) ? target : join(path, target);

    fileSystem.addSymlink(linkPath, targetPath);
  };

  return { path, fileSystem, write, mkdir, symlink };
};
