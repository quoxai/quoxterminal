/**
 * useTerminalErrorDetection -- debounced error detection for terminal panes
 *
 * Listens for terminal output activity via signalActivity(), debounces 500ms,
 * then fetches recent output from the Tauri PTY ring buffer and runs
 * detectTerminalError(). Shows detected errors for 15 seconds or until dismissed.
 *
 * Ported from quox-source/src/hooks/useTerminalErrorDetection.js
 * - Replaced fetch() with getTerminalOutput from tauri-pty
 * - Removed memory bridge integration (Phase 7)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getTerminalOutput } from '../lib/tauri-pty';
import { detectTerminalError, type DetectedError } from '../utils/terminalErrorDetector';
import { extractEntitiesFromOutput, recordDetectedError } from '../services/terminalMemoryBridge';

const DEBOUNCE_MS = 500;
const AUTO_DISMISS_MS = 15000;
const SUPPRESS_TTL_MS = 30000;
const FETCH_CHARS = 500; // Only check most recent output to avoid stale errors

/**
 * Simple ANSI-strip for error detection purposes.
 * Removes ESC sequences, OSC sequences, and common control chars.
 */
function stripAnsi(text: string): string {
  if (!text) return '';
  return text
    // CSI sequences (ESC [ ... letter)
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    // OSC sequences (ESC ] ... BEL/ST)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Other ESC sequences
    .replace(/\x1b[()#][0-9A-B]/g, '')
    .replace(/\x1b[=>]/g, '')
    // Remaining ESC + single char
    .replace(/\x1b./g, '')
    // Control chars except newline/tab
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

export interface UseTerminalErrorDetectionResult {
  detectedError: DetectedError | null;
  dismissError: () => void;
  signalActivity: () => void;
}

export function useTerminalErrorDetection(
  sessionId: string | null,
  mode: string,
): UseTerminalErrorDetectionResult {
  const [detectedError, setDetectedError] = useState<DetectedError | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressedRef = useRef<Map<string, number>>(new Map()); // errorType -> expiry timestamp
  const lastErrorTypeRef = useRef<string | null>(null);
  const lastOutputHashRef = useRef<string>('');
  const mountedRef = useRef<boolean>(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, []);

  // Clear error when session or mode changes
  useEffect(() => {
    setDetectedError(null);
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    lastErrorTypeRef.current = null;
    lastOutputHashRef.current = '';
  }, [sessionId, mode]);

  const dismissError = useCallback(() => {
    if (detectedError) {
      // Suppress by error type (more robust than exact line match)
      suppressedRef.current.set(detectedError.errorType, Date.now() + SUPPRESS_TTL_MS);
      lastErrorTypeRef.current = detectedError.errorType;
    }
    setDetectedError(null);
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
  }, [detectedError]);

  const checkForErrors = useCallback(async () => {
    if (!sessionId || mode === 'audit' || !mountedRef.current) return;

    try {
      const rawOutput = await getTerminalOutput(sessionId, FETCH_CHARS);
      if (!rawOutput || !mountedRef.current) return;

      // Skip if output hasn't changed (same command still visible)
      const outputKey = rawOutput.slice(-100);
      if (outputKey === lastOutputHashRef.current) return;
      lastOutputHashRef.current = outputKey;

      const clean = stripAnsi(rawOutput);

      // Extract entities from clean output (hosts, IPs, services, etc.)
      extractEntitiesFromOutput(clean).catch(() => {});

      const error = detectTerminalError(clean);

      if (!error || !mountedRef.current) return;

      // Record detected error in memory bridge
      recordDetectedError(
        { errorType: error.errorType, errorLine: error.errorLine },
        null,
      ).catch(() => {});

      // Check suppression by error type
      const now = Date.now();
      const suppressExpiry = suppressedRef.current.get(error.errorType);
      if (suppressExpiry && suppressExpiry > now) return;

      // Clean up expired suppressions
      for (const [key, expiry] of suppressedRef.current) {
        if (expiry <= now) suppressedRef.current.delete(key);
      }

      // Skip if it's the same error type we're already showing
      if (
        detectedError &&
        detectedError.errorType === error.errorType &&
        detectedError.errorLine === error.errorLine
      ) {
        return;
      }

      setDetectedError(error);
      lastErrorTypeRef.current = error.errorType;

      // Auto-dismiss after 15s
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setDetectedError(null);
        }
      }, AUTO_DISMISS_MS);
    } catch {
      // Silently ignore fetch errors
    }
  }, [sessionId, mode, detectedError]);

  const signalActivity = useCallback(() => {
    if (!sessionId || mode === 'audit') return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(checkForErrors, DEBOUNCE_MS);
  }, [sessionId, mode, checkForErrors]);

  return { detectedError, dismissError, signalActivity };
}
