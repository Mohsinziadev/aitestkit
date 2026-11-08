import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const SunIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const MoonIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const ChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const MenuIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const ArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ExternalIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const OutlineIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);
export const EditIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
export const CopyIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const GitHubIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);
export const NpmIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M2 7h20v9.33H12V18H7.56v-1.67H2V7Zm1.11 8.22h2.23V9.67h1.11v5.55h1.11V8.11H3.11v7.11Zm5.56-7.11v8.33H11v-1.11h2.22V8.11H8.67Zm2.22 1.11h1.11v3.34h-1.11V9.22Zm3.33-1.11v7.11h2.22V9.67h1.12v5.55h1.11V9.67h1.11v5.55H20.9V8.11h-6.67Z" />
  </svg>
);


export const ShieldIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 5 5.8v5.7c0 4.3 2.8 7.6 7 9.5 4.2-1.9 7-5.2 7-9.5V5.8Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);
export const LockIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);
export const LayersIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);
export const CodeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />
  </svg>
);
export const SwapIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />
  </svg>
);
export const TerminalIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="m7.5 10 3 2.5-3 2.5M13 15h4" />
  </svg>
);

export const DiffIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9v3a3 3 0 0 1-3 3H9" />
  </svg>
);
export const DatabaseIcon = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);
export const BracesIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1" />
  </svg>
);
export const ArrowsIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 8 3 12l4 4M17 8l4 4-4 4M14 4l-4 16" />
  </svg>
);
export const StagesIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17.5 12 22l9-4.5" />
  </svg>
);
export const GaugeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 18a9 9 0 1 1 16 0M12 14l4-5" />
    <circle cx="12" cy="15" r="1.2" />
  </svg>
);

export const Logo = () => (
  <span className="logo">
    <svg className="logo-mark" viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="logo-bg" />
      <path d="M8 17l5 5 11-12" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="logo-text">m2aitestkit</span>
  </span>
);
