/**
 * entityExtractor.ts — Pure-function entity extraction from terminal output
 *
 * Ported from quox-dashboard/src/services/memoryManager.js
 * Extracts hosts, IPs, services, containers, and ports from terminal text
 * using regex patterns. No external dependencies.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedEntity {
  type: 'host' | 'ip' | 'service' | 'container' | 'port';
  name?: string;   // host, service, container
  value?: string;  // ip, port
  source: 'pattern' | 'known_pattern';
}

// ============================================================================
// PATTERNS (from web dashboard memoryManager.js)
// ============================================================================

const ENTITY_PATTERNS: Record<string, RegExp> = {
  host: /\b(?:host|server|node|machine|vm)\s*[:\s]?\s*([a-z0-9][\w.-]+)/gi,
  ip: /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
  service: /\b(?:service|daemon|process)\s*[:\s]?\s*([a-z][\w-]+)/gi,
  container: /\b(?:container|docker|pod)\s*[:\s]?\s*([a-z][\w.-]+)/gi,
  port: /\b(?:port)\s*[:\s]?\s*(\d+)\b/gi,
};

const KNOWN_HOST_PATTERNS: RegExp[] = [
  /\b(docker\d{2}|proxmox\d{2}|nas\d{2}|grafana\d{2}|prometheus\d{2})\b/gi,
  /\b([a-z]+-\d{2,3})\b/gi,
];

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract infrastructure entities from terminal output text.
 * Returns deduplicated list of entities found via regex patterns.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  if (!text || text.length < 5) return [];

  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  // Run core patterns
  for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
    // Reset lastIndex for global regex reuse
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const captured = match[1];
      if (!captured) continue;

      const key = `${type}:${captured.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const entity: ExtractedEntity = {
        type: type as ExtractedEntity['type'],
        source: 'pattern',
      };

      if (type === 'ip' || type === 'port') {
        entity.value = captured;
      } else {
        entity.name = captured;
      }

      entities.push(entity);
    }
  }

  // Run known host patterns (deduplicated against hosts already found)
  for (const pattern of KNOWN_HOST_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const captured = match[1];
      if (!captured) continue;

      const key = `host:${captured.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      entities.push({
        type: 'host',
        name: captured,
        source: 'known_pattern',
      });
    }
  }

  return entities;
}
