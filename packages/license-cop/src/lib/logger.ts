let verboseEnabled = false;

const enableVerboseLogging = () => {
  verboseEnabled = true;
};

const log = (message: string) => {
  console.log(message);
};

const verbose = (message: string) => {
  if (verboseEnabled) {
    log(message);
  }
};

const error = (message: string) => {
  console.error(message);
};

const logger = {
  enableVerboseLogging,
  log,
  verbose,
  error
};

export default logger;
