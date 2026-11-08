import pkg from "../../package.json" with { type: "json" };

/** Real package facts, read from package.json at build time. */
export const PKG = {
  name: pkg.name,
  version: pkg.version,
  license: pkg.license,
  description: pkg.description,
  node: pkg.engines.node,
} as const;

export const REPO = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
export const NPM_URL = `https://www.npmjs.com/package/${pkg.name}`;
export const editUrl = (file: string) => `${REPO}/edit/main/docs/${file}`;

export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];
export const installCommand = (pm: PackageManager) =>
  pm === "npm"
    ? `npm install --save-dev ${PKG.name}`
    : `${pm} add ${pm === "yarn" || pm === "bun" ? "-D" : "--save-dev"} ${PKG.name}`;

/** M2Toolkit hosts this page at /npm-packages/m2aitestkit. */
export const M2TOOLKIT = "https://www.m2toolkit.com";
export const PACKAGES_URL = `${M2TOOLKIT}/npm-packages`;

export const RELATED = [
  {
    slug: "api-sentinel-js",
    title: "api-sentinel-js",
    tagline: "Detect breaking OpenAPI changes by contract position, and turn them into regression tests.",
    accent: "#2457d6",
  },
  {
    slug: "schemabridge-diff",
    title: "schemabridge-diff",
    tagline: "Directional compatibility for JSON Schema and staged migration plans for PostgreSQL DDL.",
    accent: "#d9480f",
  },
  {
    slug: "m2envguard",
    title: "m2envguard",
    tagline: "Validate, audit and compare environment configuration across environments.",
    accent: "#7c6fe0",
  },
].map((p) => ({ ...p, url: `${PACKAGES_URL}/${p.slug}` }));
