import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";

export interface ValidationResult {
  action: string;
  severity: string;
  description: string | null;
  pattern: string | null;
  blocked: boolean;
  requires_auth: boolean;
}

export interface SafetyState {
  pendingCommand: string | null;
  validationResult: ValidationResult | null;
  showWarning: boolean;
  showApproval: boolean;
  showBlocked: boolean;
}

export function useCommandSafety() {
  const [safetyState, setSafetyState] = useState<SafetyState>({
    pendingCommand: null,
    validationResult: null,
    showWarning: false,
    showApproval: false,
    showBlocked: false,
  });

  const validateCommand = useCallback(async (command: string): Promise<ValidationResult> => {
    return invoke("validate_command", { command });
  }, []);

  const checkCommand = useCallback(async (command: string): Promise<"allow" | "warn" | "block" | "approve"> => {
    const result = await validateCommand(command);

    if (result.action === "BLOCK") {
      setSafetyState({
        pendingCommand: command,
        validationResult: result,
        showWarning: false,
        showApproval: false,
        showBlocked: true,
      });
      return "block";
    }

    if (result.action === "REQUIRE_APPROVAL" || result.action === "REQUIRE_OVERRIDE") {
      setSafetyState({
        pendingCommand: command,
        validationResult: result,
        showWarning: false,
        showApproval: true,
        showBlocked: false,
      });
      return "approve";
    }

    if (result.action === "WARN") {
      setSafetyState({
        pendingCommand: command,
        validationResult: result,
        showWarning: true,
        showApproval: false,
        showBlocked: false,
      });
      // Warnings are shown but don't block - auto-dismiss after 3s
      setTimeout(() => {
        setSafetyState(prev => ({ ...prev, showWarning: false }));
      }, 3000);
      return "warn";
    }

    return "allow";
  }, [validateCommand]);

  const dismiss = useCallback(() => {
    setSafetyState({
      pendingCommand: null,
      validationResult: null,
      showWarning: false,
      showApproval: false,
      showBlocked: false,
    });
  }, []);

  const approve = useCallback(() => {
    const cmd = safetyState.pendingCommand;
    dismiss();
    return cmd;
  }, [safetyState.pendingCommand, dismiss]);

  return {
    safetyState,
    validateCommand,
    checkCommand,
    dismiss,
    approve,
  };
}
