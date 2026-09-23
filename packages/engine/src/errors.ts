export class RuleError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'RuleError';
  }
}
