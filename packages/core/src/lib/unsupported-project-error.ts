import { LicenseCopError } from "./license-cop-error";

/** The project is valid, but uses a setup that license-cop can't scan, so it can't be checked. */
export class UnsupportedProjectError extends LicenseCopError {}
