/**
 * tauri-ssh.ts — Thin wrapper around Tauri IPC for SSH operations.
 *
 * Provides typed functions for connecting to remote hosts via SSH,
 * sending data, resizing the remote PTY, and managing SSH keys.
 *
 * SSH sessions emit the same "pty-output-{sessionId}" and "pty-exit-{sessionId}"
 * events as local PTY sessions, so they work with the existing terminal UI.
 */

import { invoke } from "@tauri-apps/api/core";

/** Information about an SSH key found on disk. */
export interface SshKeyInfo {
  name: string;
  path: string;
  key_type: string | null;
  has_public_key: boolean;
}

/** Options for establishing an SSH connection. */
export interface SshConnectOptions {
  host: string;
  port?: number;
  user: string;
  authMethod: "key" | "password";
  keyPath?: string;
  keyPassphrase?: string;
  password?: string;
  bastionHost?: string;
  bastionPort?: number;
  bastionUser?: string;
  bastionKeyPath?: string;
  cols?: number;
  rows?: number;
}

/**
 * Connect to a remote host via SSH. Returns the session ID.
 *
 * The session will start emitting "pty-output-{sessionId}" events
 * with data from the remote shell, and "pty-exit-{sessionId}" when
 * the connection closes.
 */
export async function sshConnect(opts: SshConnectOptions): Promise<string> {
  return invoke("ssh_connect", {
    host: opts.host,
    port: opts.port ?? 22,
    user: opts.user,
    authMethod: opts.authMethod,
    keyPath: opts.keyPath,
    keyPassphrase: opts.keyPassphrase,
    password: opts.password,
    bastionHost: opts.bastionHost,
    bastionPort: opts.bastionPort,
    bastionUser: opts.bastionUser,
    bastionKeyPath: opts.bastionKeyPath,
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
  });
}

/** Disconnect an SSH session. */
export async function sshDisconnect(sessionId: string): Promise<void> {
  return invoke("ssh_disconnect", { sessionId });
}

/** Write data to an SSH session's remote shell. */
export async function sshWrite(sessionId: string, data: string): Promise<void> {
  return invoke("ssh_write", { sessionId, data });
}

/** Resize an SSH session's remote PTY. */
export async function sshResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("ssh_resize", { sessionId, cols, rows });
}

/** List SSH keys from ~/.ssh/. */
export async function sshListKeys(): Promise<SshKeyInfo[]> {
  return invoke("ssh_list_keys");
}

/** Check if an SSH session exists on the backend. */
export async function sshSessionExists(sessionId: string): Promise<boolean> {
  return invoke("ssh_session_exists", { sessionId });
}

/** Read last N characters from an SSH session's output ring buffer. */
export async function sshGetOutput(
  sessionId: string,
  chars: number,
): Promise<string> {
  return invoke("ssh_get_output", { sessionId, chars });
}
