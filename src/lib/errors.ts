// Typed not-found signal so UI code branches on instanceof, not message strings.
export class ProposalNotFoundError extends Error {
  constructor(id: number) {
    super(`Proposal ${id} not found`);
    this.name = "ProposalNotFoundError";
  }
}
