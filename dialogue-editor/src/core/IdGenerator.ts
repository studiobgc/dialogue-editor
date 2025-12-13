/**
 * Generates unique IDs compatible with Articy's 128-bit ID system
 */

import { ArticyId } from '../types/graph';

export class IdGenerator {
  private static counter = 0;
  private static sessionId = Date.now();

  /**
   * Generate a unique string ID for internal use
   */
  static generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const counter = (++this.counter).toString(36);
    return `${timestamp}-${random}-${counter}`;
  }

  /**
   * Generate an Articy-compatible 128-bit ID
   */
  static generateArticyId(): ArticyId {
    const high = BigInt(Date.now()) << BigInt(32) | BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
    const low = BigInt(this.sessionId) << BigInt(32) | BigInt(++this.counter);
    
    return {
      high: Number(high & BigInt(0xFFFFFFFFFFFFFFFF)),
      low: Number(low & BigInt(0xFFFFFFFFFFFFFFFF))
    };
  }

  /**
   * Convert ArticyId to string representation
   */
  static articyIdToString(id: ArticyId): string {
    return `0x${id.high.toString(16).padStart(16, '0')}${id.low.toString(16).padStart(16, '0')}`;
  }

  /**
   * Parse string representation back to ArticyId
   */
  static stringToArticyId(str: string): ArticyId {
    const hex = str.replace('0x', '');
    return {
      high: parseInt(hex.substring(0, 16), 16) || 0,
      low: parseInt(hex.substring(16, 32), 16) || 0
    };
  }

  /**
   * Generate a technical name from a display name
   */
  static toTechnicalName(displayName: string): string {
    return displayName
      .replace(/[^a-zA-Z0-9_\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^(\d)/, '_$1')
      .substring(0, 64);
  }
}
