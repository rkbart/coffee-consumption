interface IconProps {
  size?: number;
  className?: string;
}

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconDashboard = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="3" width="7" height="8" rx="2" />
    <rect x="14" y="3" width="7" height="5" rx="2" />
    <rect x="14" y="12" width="7" height="9" rx="2" />
    <rect x="3" y="15" width="7" height="6" rx="2" />
  </svg>
);

export const IconRecipes = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3h9a3 3 0 0 1 3 3v15l-6-3-6 3V6a3 3 0 0 1 3-3Z" />
    <path d="M9 8h6M9 11.5h4" />
  </svg>
);

export const IconLibrary = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4h6v16H4zM10 4h5v16h-5z" />
    <path d="m16.2 5.4 4.2-1.1 3 15.6-4.2 1.1zM6 8h2M6 11h2M12 8h1.5M12 11h1.5" />
  </svg>
);

export const IconInventory = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
    <path d="m4 8.5 8 4.5 8-4.5M12 13v7" />
  </svg>
);

export const IconHistory = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconPlus = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconEdit = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14 6 4 4" />
  </svg>
);

export const IconTrash = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);

export const IconClose = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconArrowLeft = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M19 12H5m6-7-7 7 7 7" />
  </svg>
);

export const IconArrowRight = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14m-6-7 7 7-7 7" />
  </svg>
);

export const IconCheck = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const IconCoffee = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
    <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 3v2.5M11 3v2.5M15 3v2.5" />
  </svg>
);

export const IconMilk = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 3h6M9.5 3v4L7 11v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8l-2.5-4V3" />
    <path d="M7 13h10" />
  </svg>
);

export const IconScale = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4v17M7 21h10M4 8h16M6 8l-3 6h6L6 8ZM18 8l-3 6h6l-3-6Z" />
  </svg>
);

export const IconSearch = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const IconArrowUp = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 19V5m-7 7 7-7 7 7" />
  </svg>
);

export const IconPrinter = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <path d="M7 14h10v7H7z" />
  </svg>
);

export const IconShare = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.3M8.2 13.2l7.6 4.3" />
  </svg>
);

export const IconReport = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3h8l5 5v13H6z" />
    <path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-4" />
  </svg>
);

export const IconSettings = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h8M16 7h4M4 17h3M11 17h9M14 4v6M8 14v6" />
  </svg>
);

export const IconDownload = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />
  </svg>
);

export const IconUpload = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 16V4m-5 5 5-5 5 5M5 21h14" />
  </svg>
);

export const IconDatabase = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <ellipse cx="12" cy="5.5" rx="7" ry="3" />
    <path d="M5 5.5v13c0 1.7 3.1 3 7 3s7-1.3 7-3v-13M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
);

export const IconSpark = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m12 3 1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
  </svg>
);
