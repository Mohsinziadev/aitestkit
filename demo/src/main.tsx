import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./site.css";
import { App } from "./App";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// `npm run build:site` prerenders the page; the dev server serves an empty root.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
