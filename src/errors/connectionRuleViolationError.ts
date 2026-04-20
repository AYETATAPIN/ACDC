export class ConnectionRuleViolationError extends Error {
  readonly code: string;
  readonly details: { from: string; to: string; connection_type: string };

  constructor(details: { from: string; to: string; connection_type: string }) {
    super('Connection is not allowed by diagram type rules');
    this.name = 'ConnectionRuleViolationError';
    this.code = 'CONNECTION_RULE_VIOLATION';
    this.details = details;
  }
}
