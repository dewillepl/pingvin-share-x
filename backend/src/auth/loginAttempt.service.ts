import { Injectable } from "@nestjs/common";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const PRUNE_THRESHOLD = 1000;

/**
 * Tracks failed sign-in attempts per account identifier (username or email),
 * independent of the client IP. This limits password spraying, especially
 * against LDAP/AD accounts, where every attempt is a bind on the directory.
 */
@Injectable()
export class LoginAttemptService {
  private attempts = new Map<string, { count: number; firstAt: number }>();

  private normalize(identifier: string) {
    return identifier.toLowerCase().trim();
  }

  isLocked(identifier: string): boolean {
    const entry = this.attempts.get(this.normalize(identifier));
    if (!entry) return false;
    if (Date.now() - entry.firstAt > WINDOW_MS) {
      this.attempts.delete(this.normalize(identifier));
      return false;
    }
    return entry.count >= MAX_FAILED_ATTEMPTS;
  }

  registerFailure(identifier: string) {
    const key = this.normalize(identifier);
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.firstAt > WINDOW_MS) {
      this.attempts.set(key, { count: 1, firstAt: now });
    } else {
      entry.count++;
    }

    if (this.attempts.size > PRUNE_THRESHOLD) this.prune(now);
  }

  reset(identifier: string) {
    this.attempts.delete(this.normalize(identifier));
  }

  private prune(now: number) {
    for (const [key, entry] of this.attempts) {
      if (now - entry.firstAt > WINDOW_MS) this.attempts.delete(key);
    }
  }
}
