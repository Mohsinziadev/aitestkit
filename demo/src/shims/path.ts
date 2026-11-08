/** Only the file-loading helpers use these; the browser never loads a suite from disk. */
export const dirname = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));
export const extname = (path: string): string => {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") ? path.slice(dot) : "";
};
export const resolve = (...parts: string[]): string => parts.join("/");
