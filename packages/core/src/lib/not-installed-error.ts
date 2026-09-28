import { LicenseCopError } from "./license-cop-error";

/** The project's dependencies haven't been installed, so there is nothing on disk to check. */
export class NotInstalledError extends LicenseCopError {}
