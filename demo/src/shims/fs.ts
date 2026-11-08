/** The browser has no filesystem. The playground evaluates pasted text, so these are never reached. */
const unavailable = (): never => {
  throw new Error("The filesystem is not available in the browser.");
};
export const readFile = unavailable;
export const writeFile = unavailable;
export const mkdir = unavailable;
