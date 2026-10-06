import { BunIsolatedEngine } from "./dependency-scanning/bun/bun-isolated-engine";
import { BunStoreResolver } from "./dependency-scanning/bun/bun-store-resolver";
import { LicenseDependencyClassifier } from "./dependency-scanning/dependency-classifier";
import { EngineRegistry } from "./dependency-scanning/engine-registry";
import {
  ArboristTreeLoader,
  type InstalledTreeLoader
} from "./dependency-scanning/node-modules/arborist-tree-loader";
import { NodeModulesEngine } from "./dependency-scanning/node-modules/node-modules-engine";
import {
  LockfilePnpmHierarchyReader,
  type PnpmHierarchyReader
} from "./dependency-scanning/pnpm/pnpm-hierarchy-reader";
import {
  LockfilePnpmProjectLocator,
  type PnpmProjectLocator
} from "./dependency-scanning/pnpm/pnpm-project-locator";
import { PnpmStoreEngine } from "./dependency-scanning/pnpm/pnpm-store-engine";
import {
  PnpApiInstallReader,
  type PnpInstallReader
} from "./dependency-scanning/yarn-pnp/pnp-install-reader";
import { YarnPnpEngine } from "./dependency-scanning/yarn-pnp/yarn-pnp-engine";
import { ZipFileSystem } from "./dependency-scanning/yarn-pnp/zip-file-system";
import { FileBunLockReader } from "./dependency/bun-lock-reader";
import { InstallationVerifier } from "./dependency/installation-verifier";
import { FilePackageJsonReader } from "./dependency/package-json-reader";
import { LicenseChecker } from "./license-checker";
import { CallbackLogger, NullLogger, type Logger } from "./logging/logger";
import type { OnVerbose } from "./on-verbose";
import { OptionsNormalizer } from "./options-normalizer";
import { BunPackageManager } from "./package-managers/bun-package-manager";
import { NpmPackageManager } from "./package-managers/npm-package-manager";
import { PackageManagerDetector } from "./package-managers/package-manager-detector";
import { PlugAndPlayDetector } from "./package-managers/plug-and-play-detector";
import { PnpmPackageManager } from "./package-managers/pnpm-package-manager";
import { YarnPackageManager } from "./package-managers/yarn-package-manager";
import { NodeFileSystem, type FileSystem } from "./utils/file-system";

/** The pieces of the object graph that something outside it (the entry point, a test) needs. */
export type Services = {
  licenseChecker: LicenseChecker;
  packageManagerDetector: PackageManagerDetector;
  installationVerifier: InstallationVerifier;
  packageManagers: {
    npm: NpmPackageManager;
    yarn: YarnPackageManager;
    pnpm: PnpmPackageManager;
    bun: BunPackageManager;
  };
  engines: {
    nodeModules: NodeModulesEngine;
    pnpmStore: PnpmStoreEngine;
    bunIsolated: BunIsolatedEngine;
    yarnPnp: YarnPnpEngine;
  };
};

/**
 * The edges of the object graph that reach outside the process: the disk, and the libraries (and
 * the one generated file) that read a package manager's own install. All default to the real thing; a test swaps in a
 * double for whichever it doesn't want to touch.
 */
export type Gateways = {
  fileSystem?: FileSystem;
  treeLoader?: InstalledTreeLoader;
  pnpmProjectLocator?: PnpmProjectLocator;
  pnpmHierarchyReader?: PnpmHierarchyReader;
  yarnPnpInstallReader?: PnpInstallReader;
  /** What the Plug'n'Play engine reads each package's package.json through: one that sees into zips. */
  yarnPnpFileSystem?: FileSystem;
};

/** A checker that reports its progress to `onVerbose`, if the caller gave one. */
export const createLicenseChecker = (
  onVerbose?: OnVerbose,
  gateways?: Gateways
): LicenseChecker => {
  const logger = onVerbose ? new CallbackLogger(onVerbose) : new NullLogger();
  const services = compose(logger, gateways);

  return services.licenseChecker;
};

/** The one place anything is constructed: every dependency is handed in from here. */
export const compose = (logger: Logger = new NullLogger(), gateways: Gateways = {}): Services => {
  const fileSystem = gateways.fileSystem ?? new NodeFileSystem();
  const packageJsonReader = new FilePackageJsonReader(fileSystem, logger);
  const bunLockReader = new FileBunLockReader(fileSystem, logger);

  const classifier = new LicenseDependencyClassifier(logger);

  const plugAndPlayDetector = new PlugAndPlayDetector(fileSystem);

  const npm = new NpmPackageManager();
  const yarn = new YarnPackageManager(plugAndPlayDetector);
  const pnpm = new PnpmPackageManager();
  const bun = new BunPackageManager(fileSystem);

  const packageManagerDetector = new PackageManagerDetector(
    { npm, yarn, pnpm, bun },
    fileSystem,
    packageJsonReader
  );

  const treeLoader = gateways.treeLoader ?? new ArboristTreeLoader();
  const nodeModules = new NodeModulesEngine(classifier, treeLoader, packageJsonReader, logger);

  const projectLocator = gateways.pnpmProjectLocator ?? new LockfilePnpmProjectLocator();
  const hierarchyReader = gateways.pnpmHierarchyReader ?? new LockfilePnpmHierarchyReader();
  const pnpmStore = new PnpmStoreEngine(
    classifier,
    projectLocator,
    hierarchyReader,
    packageJsonReader,
    logger
  );

  const storeResolver = new BunStoreResolver(fileSystem);
  const bunIsolated = new BunIsolatedEngine(
    classifier,
    bunLockReader,
    storeResolver,
    packageJsonReader,
    logger
  );

  const pnpInstallReader =
    gateways.yarnPnpInstallReader ?? new PnpApiInstallReader(plugAndPlayDetector);
  const pnpFileSystem = gateways.yarnPnpFileSystem ?? new ZipFileSystem();
  const pnpPackageJsonReader = new FilePackageJsonReader(pnpFileSystem, logger);
  const yarnPnp = new YarnPnpEngine(classifier, pnpInstallReader, pnpPackageJsonReader, logger);

  const engineRegistry = new EngineRegistry({ nodeModules, pnpmStore, bunIsolated, yarnPnp });

  const optionsNormalizer = new OptionsNormalizer(() => process.cwd());
  const installationVerifier = new InstallationVerifier(
    fileSystem,
    packageJsonReader,
    plugAndPlayDetector
  );
  const licenseChecker = new LicenseChecker(
    optionsNormalizer,
    packageManagerDetector,
    installationVerifier,
    engineRegistry
  );

  return {
    licenseChecker,
    packageManagerDetector,
    installationVerifier,
    packageManagers: { npm, yarn, pnpm, bun },
    engines: { nodeModules, pnpmStore, bunIsolated, yarnPnp }
  };
};
