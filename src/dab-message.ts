/**
 * Message sent from injected providers, to Essentials.
 */
export type DABMessagePayload = {
  id: number; // Generated ID, used to map the request with the response
  name: string; // Command name
  object: any; // Usually, the ETH JSON RPC payload.
}