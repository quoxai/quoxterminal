import { describe, it, expect } from 'vitest';
import {
  TERMINAL_MODES,
  DEFAULT_MODE,
  MODE_EXEC_POLICIES,
  MODE_FILE_POLICIES,
  composeSystemPrompt,
} from '../config/terminalModes';
import type { ModeId } from '../config/terminalModes';

describe('terminalModes', () => {
  describe('TERMINAL_MODES', () => {
    it('defines all four modes', () => {
      expect(Object.keys(TERMINAL_MODES)).toEqual(
        expect.arrayContaining(['strict', 'balanced', 'builder', 'audit']),
      );
    });

    it('each mode has label, description, color', () => {
      for (const mode of Object.values(TERMINAL_MODES)) {
        expect(mode.label).toBeTruthy();
        expect(mode.description).toBeTruthy();
        expect(mode.color).toMatch(/^#/);
      }
    });
  });

  describe('DEFAULT_MODE', () => {
    it('is balanced', () => {
      expect(DEFAULT_MODE).toBe('balanced');
    });
  });

  describe('MODE_EXEC_POLICIES', () => {
    it('strict: warnAsBlock=true, showRunButtons=true', () => {
      expect(MODE_EXEC_POLICIES.strict.warnAsBlock).toBe(true);
      expect(MODE_EXEC_POLICIES.strict.showRunButtons).toBe(true);
    });

    it('balanced: warnAsBlock=false, showRunButtons=true', () => {
      expect(MODE_EXEC_POLICIES.balanced.warnAsBlock).toBe(false);
      expect(MODE_EXEC_POLICIES.balanced.showRunButtons).toBe(true);
    });

    it('builder: warnAsBlock=false, showRunButtons=true', () => {
      expect(MODE_EXEC_POLICIES.builder.warnAsBlock).toBe(false);
      expect(MODE_EXEC_POLICIES.builder.showRunButtons).toBe(true);
    });

    it('audit: warnAsBlock=true, showRunButtons=false', () => {
      expect(MODE_EXEC_POLICIES.audit.warnAsBlock).toBe(true);
      expect(MODE_EXEC_POLICIES.audit.showRunButtons).toBe(false);
    });

    it('no mode has autoExec=true', () => {
      for (const policy of Object.values(MODE_EXEC_POLICIES)) {
        expect(policy.autoExec).toBe(false);
      }
    });
  });

  describe('MODE_FILE_POLICIES', () => {
    it('strict: showApplyButtons=true, requireConfirmModal=true', () => {
      expect(MODE_FILE_POLICIES.strict.showApplyButtons).toBe(true);
      expect(MODE_FILE_POLICIES.strict.requireConfirmModal).toBe(true);
    });

    it('balanced: showApplyButtons=true, requireConfirmModal=false', () => {
      expect(MODE_FILE_POLICIES.balanced.showApplyButtons).toBe(true);
      expect(MODE_FILE_POLICIES.balanced.requireConfirmModal).toBe(false);
    });

    it('audit: showApplyButtons=false, requireConfirmModal=false', () => {
      expect(MODE_FILE_POLICIES.audit.showApplyButtons).toBe(false);
      expect(MODE_FILE_POLICIES.audit.requireConfirmModal).toBe(false);
    });
  });

  describe('composeSystemPrompt', () => {
    it('includes base system prompt', () => {
      const prompt = composeSystemPrompt('balanced');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('includes mode-specific policy', () => {
      const strict = composeSystemPrompt('strict');
      const builder = composeSystemPrompt('builder');
      // Different modes produce different prompts
      expect(strict).not.toBe(builder);
    });

    it('defaults to balanced when no mode given', () => {
      const defaultPrompt = composeSystemPrompt();
      const balancedPrompt = composeSystemPrompt('balanced');
      expect(defaultPrompt).toBe(balancedPrompt);
    });
  });
});
