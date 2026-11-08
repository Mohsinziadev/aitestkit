import { useEffect, useState } from "react";
import { CloseIcon, GitHubIcon, Logo, MenuIcon, MoonIcon, NpmIcon, SearchIcon, SunIcon } from "./icons";
import { NPM_URL, PACKAGES_URL, PKG, REPO } from "./meta";
import { docHref, type Route } from "./router";

const LINKS = [
  { label: "Outcomes", href: "#outcomes", match: () => false },
  { label: "Workflow", href: "#workflow", match: () => false },
  { label: "Playground", href: "#playground", match: () => false },
  {
    label: "Docs",
    href: docHref("getting-started"),
    match: (r: Route) => r.view === "docs" && r.slug !== "assertions",
  },
  {
    label: "Assertions",
    href: docHref("assertions"),
    match: (r: Route) => r.view === "docs" && r.slug === "assertions",
  },
];

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("m2aitestkit-site:theme", next);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}

export function Nav({ route, onSearch }: { route: Route; onSearch: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mac, setMac] = useState(true);

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  useEffect(() => setMenuOpen(false), [route]);

  return (
    <header className="bar" data-menu={menuOpen || undefined}>
      <div className="bar-inner">
        <a className="bar-brand" href="#" aria-label="m2aitestkit home" onClick={() => window.scrollTo(0, 0)}>
          <Logo />
        </a>
        <nav className="bar-links" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className={l.match(route) ? "active" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="bar-tools">
          <span className="bar-version" title="Current version">v{PKG.version}</span>
          <button type="button" className="bar-search" onClick={onSearch} aria-label="Search documentation">
            <SearchIcon />
            <span className="bar-search-label">Search</span>
            <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>
          </button>
          <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle dark mode">
            <SunIcon className="icon-sun" />
            <MoonIcon className="icon-moon" />
          </button>
          <a className="icon-button bar-ext" href={REPO} target="_blank" rel="noreferrer" aria-label="m2aitestkit on GitHub">
            <GitHubIcon />
          </a>
          <a className="icon-button bar-ext" href={NPM_URL} target="_blank" rel="noreferrer" aria-label="m2aitestkit on npm">
            <NpmIcon />
          </a>
          <button
            type="button"
            className="icon-button bar-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="bar-sheet" aria-label="Mobile">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>
          ))}
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <a href={PACKAGES_URL}>More M2Toolkit packages</a>
          <button type="button" onClick={onSearch}>Search the docs</button>
        </nav>
      )}
    </header>
  );
}
