/**
 * claudeTrustProfile.ts — Trust rule evaluation for Claude Mode.
 *
 * Determines whether a tool call should be auto-approved based on
 * the active trust profile and the tool call's properties.
 */

export interface TrustProfile {
  /** Auto-approve Read tool calls */
  autoApproveReads: boolean;
  /** Auto-approve search tools (Grep, Glob) */
  autoApproveSearch: boolean;
  /** Auto-approve Bash commands when cwd is within project */
  autoApproveBashInProject: boolean;
  /** Auto-approve edits to test/spec files */
  autoApproveTestEdits: boolean;
  /** Auto-approve everything (dangerous) */
  autoApproveAll: boolean;
}

export const DEFAULT_TRUST_PROFILE: TrustProfile = {
  autoApproveReads: true,
  autoApproveSearch: true,
  autoApproveBashInProject: false,
  autoApproveTestEdits: false,
  autoApproveAll: false,
};

export const TRUST_PRESETS: Record<string, TrustProfile> = {
  cautious: {
    autoApproveReads: false,
    autoApproveSearch: false,
    autoApproveBashInProject: false,
    autoApproveTestEdits: false,
    autoApproveAll: false,
  },
  balanced: DEFAULT_TRUST_PROFILE,
  permissive: {
    autoApproveReads: true,
    autoApproveSearch: true,
    autoApproveBashInProject: true,
    autoApproveTestEdits: true,
    autoApproveAll: false,
  },
  yolo: {
    autoApproveReads: true,
    autoApproveSearch: true,
    autoApproveBashInProject: true,
    autoApproveTestEdits: true,
    autoApproveAll: true,
  },
};

/** Test/spec file patterns */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\.test\.rs$/,
  /_test\.go$/,
  /test_.*\.py$/,
];

/**
 * Evaluate whether a tool call should be auto-approved.
 *
 * @returns true if the tool call should be auto-approved, false if manual approval needed
 */
export function shouldAutoApprove(
  profile: TrustProfile,
  toolName: string,
  toolInput: Record<string, unknown>,
  projectCwd?: string,
): boolean {
  if (profile.autoApproveAll) return true;

  switch (toolName) {
    case "Read":
      return profile.autoApproveReads;

    case "Grep":
    case "Glob":
      return profile.autoApproveSearch;

    case "Edit":
    case "Write": {
      if (!profile.autoApproveTestEdits) return false;
      const filePath = String(toolInput.file_path || "");
      return isTestFile(filePath);
    }

    case "Bash": {
      if (!profile.autoApproveBashInProject) return false;
      // Only auto-approve if we can verify the command runs within project
      if (!projectCwd) return false;
      const command = String(toolInput.command || "");
      const bashCwd = String(toolInput.cwd || projectCwd);
      return bashCwd.startsWith(projectCwd) && !isDangerousCommand(command);
    }

    case "WebSearch":
    case "WebFetch":
      return profile.autoApproveSearch;

    // Agent, AskUserQuestion, NotebookEdit — never auto-approve
    default:
      return false;
  }
}

function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filePath));
}

/** Refuse to auto-approve obviously dangerous bash commands */
function isDangerousCommand(command: string): boolean {
  const dangerous = [
    /rm\s+-rf/i,
    /dd\s+if=/i,
    /mkfs\./i,
    /shutdown/i,
    /reboot/i,
    /curl.*\|\s*(sh|bash)/i,
    /wget.*\|\s*(sh|bash)/i,
    />\s*\/dev\//i,
    /chmod\s+777/i,
    /git\s+push\s+--force/i,
    /git\s+reset\s+--hard/i,
  ];
  return dangerous.some((p) => p.test(command));
}
