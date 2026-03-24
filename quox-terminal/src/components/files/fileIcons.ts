/**
 * fileIcons.ts — Maps file extensions and names to unicode icons and colours.
 *
 * Uses unicode characters instead of SVGs for reliability on dark themes.
 * Colours reference --fe-icon-* CSS custom properties but are also provided
 * as hex values for inline style usage.
 */

export interface FileIcon {
  icon: string;
  color: string;
  label: string;
}

/** Extension → icon mapping. Case-insensitive lookup. */
const EXTENSION_MAP: Record<string, FileIcon> = {
  // TypeScript
  ts:   { icon: "TS", color: "#3178c6", label: "TypeScript" },
  tsx:  { icon: "TS", color: "#3178c6", label: "TypeScript React" },
  mts:  { icon: "TS", color: "#3178c6", label: "TypeScript" },
  cts:  { icon: "TS", color: "#3178c6", label: "TypeScript" },

  // JavaScript
  js:   { icon: "JS", color: "#d4a017", label: "JavaScript" },
  jsx:  { icon: "JS", color: "#d4a017", label: "JavaScript React" },
  mjs:  { icon: "JS", color: "#d4a017", label: "JavaScript" },
  cjs:  { icon: "JS", color: "#d4a017", label: "JavaScript" },

  // Rust
  rs:   { icon: "Rs", color: "#ce422b", label: "Rust" },

  // Go
  go:   { icon: "Go", color: "#00add8", label: "Go" },

  // Python
  py:   { icon: "Py", color: "#3776ab", label: "Python" },

  // Data / Config
  json: { icon: "{}", color: "#a8b1c2", label: "JSON" },
  yaml: { icon: "⚙",  color: "#8b6914", label: "YAML" },
  yml:  { icon: "⚙",  color: "#8b6914", label: "YAML" },
  toml: { icon: "⚙",  color: "#8b6914", label: "TOML" },
  ini:  { icon: "⚙",  color: "#7b8794", label: "INI" },
  env:  { icon: "⚙",  color: "#7b8794", label: "Environment" },

  // Markup
  html: { icon: "<>", color: "#e44d26", label: "HTML" },
  htm:  { icon: "<>", color: "#e44d26", label: "HTML" },
  xml:  { icon: "<>", color: "#e44d26", label: "XML" },
  svg:  { icon: "◇",  color: "#e44d26", label: "SVG" },

  // Styles
  css:  { icon: "#",  color: "#264de4", label: "CSS" },
  scss: { icon: "#",  color: "#c6538c", label: "SCSS" },
  less: { icon: "#",  color: "#1d365d", label: "Less" },

  // Markdown / Docs
  md:   { icon: "M↓", color: "#7b8794", label: "Markdown" },
  mdx:  { icon: "M↓", color: "#7b8794", label: "MDX" },
  txt:  { icon: "¶",  color: "#7b8794", label: "Text" },
  rst:  { icon: "¶",  color: "#7b8794", label: "reStructuredText" },

  // Shell
  sh:   { icon: "$",  color: "#4eaa25", label: "Shell" },
  bash: { icon: "$",  color: "#4eaa25", label: "Bash" },
  zsh:  { icon: "$",  color: "#4eaa25", label: "Zsh" },
  fish: { icon: "$",  color: "#4eaa25", label: "Fish" },

  // Docker
  dockerfile: { icon: "🐳", color: "#2496ed", label: "Dockerfile" },

  // Images
  png:  { icon: "▣",  color: "#7b8794", label: "PNG" },
  jpg:  { icon: "▣",  color: "#7b8794", label: "JPEG" },
  jpeg: { icon: "▣",  color: "#7b8794", label: "JPEG" },
  gif:  { icon: "▣",  color: "#7b8794", label: "GIF" },
  webp: { icon: "▣",  color: "#7b8794", label: "WebP" },
  ico:  { icon: "▣",  color: "#7b8794", label: "Icon" },

  // Lock / Package
  lock: { icon: "🔒", color: "#7b8794", label: "Lock file" },

  // SQL
  sql:  { icon: "⛁",  color: "#336791", label: "SQL" },

  // C / C++
  c:    { icon: "C",  color: "#555555", label: "C" },
  h:    { icon: "H",  color: "#555555", label: "C Header" },
  cpp:  { icon: "C+", color: "#004482", label: "C++" },
  hpp:  { icon: "H+", color: "#004482", label: "C++ Header" },

  // Java / Kotlin
  java: { icon: "Jv", color: "#b07219", label: "Java" },
  kt:   { icon: "Kt", color: "#7f52ff", label: "Kotlin" },

  // Ruby
  rb:   { icon: "Rb", color: "#cc342d", label: "Ruby" },

  // PHP
  php:  { icon: "Php",color: "#777bb4", label: "PHP" },

  // Misc
  log:  { icon: "▤",  color: "#7b8794", label: "Log" },
  csv:  { icon: "▤",  color: "#7b8794", label: "CSV" },
};

/** Special filename → icon mapping (exact match, case-insensitive). */
const FILENAME_MAP: Record<string, FileIcon> = {
  "dockerfile":       { icon: "🐳", color: "#2496ed", label: "Dockerfile" },
  "docker-compose.yml": { icon: "🐳", color: "#2496ed", label: "Docker Compose" },
  "docker-compose.yaml": { icon: "🐳", color: "#2496ed", label: "Docker Compose" },
  "makefile":         { icon: "M",  color: "#7b8794", label: "Makefile" },
  "cmakelists.txt":   { icon: "M",  color: "#7b8794", label: "CMake" },
  ".gitignore":       { icon: "G",  color: "#f05032", label: "Git Ignore" },
  ".gitmodules":      { icon: "G",  color: "#f05032", label: "Git Modules" },
  ".gitattributes":   { icon: "G",  color: "#f05032", label: "Git Attributes" },
  ".editorconfig":    { icon: "⚙",  color: "#7b8794", label: "EditorConfig" },
  ".prettierrc":      { icon: "⚙",  color: "#7b8794", label: "Prettier" },
  ".eslintrc":        { icon: "⚙",  color: "#7b8794", label: "ESLint" },
  ".eslintrc.json":   { icon: "⚙",  color: "#7b8794", label: "ESLint" },
  ".eslintrc.js":     { icon: "⚙",  color: "#7b8794", label: "ESLint" },
  "license":          { icon: "§",  color: "#7b8794", label: "License" },
  "license.md":       { icon: "§",  color: "#7b8794", label: "License" },
  "readme.md":        { icon: "i",  color: "#7b8794", label: "Readme" },
  "cargo.toml":       { icon: "📦", color: "#ce422b", label: "Cargo" },
  "cargo.lock":       { icon: "🔒", color: "#ce422b", label: "Cargo Lock" },
  "package.json":     { icon: "📦", color: "#cb3837", label: "npm Package" },
  "package-lock.json":{ icon: "🔒", color: "#cb3837", label: "npm Lock" },
  "tsconfig.json":    { icon: "TS", color: "#3178c6", label: "TypeScript Config" },
  "vite.config.ts":   { icon: "⚡", color: "#646cff", label: "Vite Config" },
  "vite.config.js":   { icon: "⚡", color: "#646cff", label: "Vite Config" },
  "tauri.conf.json":  { icon: "T",  color: "#ffc131", label: "Tauri Config" },
};

const FOLDER_ICON: FileIcon =      { icon: "▸", color: "#38bdf8", label: "Folder" };
const FOLDER_OPEN_ICON: FileIcon =  { icon: "▾", color: "#7dd3fc", label: "Folder" };
const DEFAULT_FILE_ICON: FileIcon = { icon: "·",  color: "#7b8794", label: "File" };

/** Get the icon for a file or folder. */
export function getFileIcon(
  name: string,
  isDir: boolean,
  isExpanded = false,
): FileIcon {
  if (isDir) {
    return isExpanded ? FOLDER_OPEN_ICON : FOLDER_ICON;
  }

  // Check exact filename first
  const lowerName = name.toLowerCase();
  if (FILENAME_MAP[lowerName]) {
    return FILENAME_MAP[lowerName];
  }

  // Check extension
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx > 0) {
    const ext = name.slice(dotIdx + 1).toLowerCase();
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  return DEFAULT_FILE_ICON;
}
