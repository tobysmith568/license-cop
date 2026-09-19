export type OnVerbose = (message: string) => void;

export const noopOnVerbose: OnVerbose = () => {};
