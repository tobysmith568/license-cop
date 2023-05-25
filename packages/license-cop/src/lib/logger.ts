let loggerEnabled = false;
let verboseEnabled = false;

const enableLogging = () => {
  loggerEnabled = true;
};

const enableVerboseLogging = () => {
  verboseEnabled = true;

  verbose("Verbose logging enabled");
};

const log = (message: string) => {
  if (loggerEnabled) {
    console.log(message);
  }
};

const verbose = (message: string) => {
  if (loggerEnabled && verboseEnabled) {
    log(message);
  }
};

const error = (message: string) => {
  if (loggerEnabled) {
    console.error(message);
  }
};

const logger = {
  enableLogging,
  enableVerboseLogging,
  log,
  verbose,
  error
};

export default logger;
