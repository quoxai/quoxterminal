import { invoke } from "@tauri-apps/api/core";

export async function collectorConnect(
  url: string,
  token?: string
): Promise<void> {
  return invoke("collector_connect", { url, token });
}

export async function collectorDisconnect(): Promise<void> {
  return invoke("collector_disconnect");
}

export async function collectorStatus(): Promise<string> {
  return invoke("collector_status");
}
