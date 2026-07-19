// domain/states.ts — FSM state definitions.
// Per Skill §2: enum-based states (TS union type). Value format: "feature:state".
// This is a domain concept (it's part of the ubiquitous language), so it lives here.

export type SofiaState =
  | "START"
  | "ASK_NAME"
  | "ASK_BIRTH_DATE"
  | "ASK_BIRTH_TIME"
  | "ASK_BIRTH_PLACE"
  | "PROBING"
  | "FREE_READING"
  | "CONVERSATION"
  | "PAID_HOOK"
  | "TARO_ASK_NUMBERS"
  | "TARO_SMALL"
  | "TARO_FULL"
  | "TARO_LOVE"
  | "TARO_CAREER"
  | "TARO_DECISION"
  | "HOROSCOPE"
  | "SINGLE_CARD"
  | "CARD_OF_DAY"
  | "DREAM"
  | "YES_NO_ASK"
  | "BLOCKED"
  | "AWAIT_DELETE_CONFIRM"
  | "BROADCAST"
  | "ADMIN_PANEL";

export const ONBOARDING_STATES: SofiaState[] = [
  "START", "ASK_NAME", "ASK_BIRTH_DATE", "ASK_BIRTH_TIME", "ASK_BIRTH_PLACE",
  "PROBING", "FREE_READING",
];

export function isOnboarding(state: SofiaState): boolean {
  return ONBOARDING_STATES.includes(state);
}

export function isReadingState(state: SofiaState): boolean {
  return ["TARO_SMALL", "TARO_FULL", "TARO_LOVE", "TARO_CAREER", "TARO_DECISION",
    "HOROSCOPE", "SINGLE_CARD", "CARD_OF_DAY", "YES_NO_ASK"].includes(state);
}
