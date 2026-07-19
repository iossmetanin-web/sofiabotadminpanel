// domain/exceptions.ts — domain error hierarchy.
// Per Skill §2: specific exceptions, never bare Exception. Each carries context.

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// User
export class UserNotFoundError extends DomainError {
  constructor(public telegramId: string) {
    super(`User not found: ${telegramId}`);
  }
}
export class UserBlockedError extends DomainError {
  constructor(public telegramId: string) {
    super(`User is blocked: ${telegramId}`);
  }
}

// Billing
export class InsufficientCrystalsError extends DomainError {
  constructor(public needed: number, public available: number) {
    super(`Insufficient crystals: need ${needed}, have ${available}`);
  }
}

// Cooldowns
export class CooldownActiveError extends DomainError {
  constructor(public untilMs: number) {
    super(`Cooldown active until ${new Date(untilMs).toISOString()}`);
  }
}

// Onboarding
export class OnboardingIncompleteError extends DomainError {
  constructor(public step: string) {
    super(`Onboarding incomplete at step ${step}`);
  }
}

// LLM hierarchy (per Skill §7)
export class LLMError extends DomainError {
  constructor(message: string, public provider: string) {
    super(message);
  }
}
export class LLMRateLimitError extends LLMError {
  constructor(public retryAfterSeconds: number) {
    super(`LLM rate limited (retry after ${retryAfterSeconds}s)`, "zai");
  }
}
export class LLMTimeoutError extends LLMError {
  constructor(public timeoutSeconds: number) {
    super(`LLM timed out after ${timeoutSeconds}s`, "zai");
  }
}
export class LLMContentFilterError extends LLMError {
  constructor() {
    super("LLM content filter triggered", "zai");
  }
}
export class LLMContextLengthError extends LLMError {
  constructor(public promptTokens: number, public maxTokens: number) {
    super(`Context too long: ${promptTokens} > ${maxTokens}`, "zai");
  }
}
export class LLMEmptyResponseError extends LLMError {
  constructor() {
    super("LLM returned empty response", "zai");
  }
}

// Validation
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

// Repository
export class RepositoryError extends DomainError {
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}
