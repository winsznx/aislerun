import { decodePaymentSignatureHeader } from "@x402/core/http";
import { z } from "zod";
import { sha256Hex } from "../../../packages/shared/src/tokens.js";

const ExactEvmPayload = z.object({
  authorization: z.object({
    from: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    value: z.string().regex(/^\d+$/),
  }),
});

export interface PaymentIdentity {
  payer: string;
  network: string;
  amountAtomic: string;
  fingerprint: string;
}

// The EIP-3009 nonce is unique per signed transfer, so (network, payer, nonce) identifies one payment
// both in the request handler (from the header) and in the settle hook (from the decoded payload).
export function identityFromPayload(payload: { accepted?: { network?: string }; payload?: unknown }): PaymentIdentity {
  const parsed = ExactEvmPayload.parse(payload.payload);
  const network = payload.accepted?.network;
  if (!network) throw new Error("payment payload has no accepted network");
  const payer = parsed.authorization.from.toLowerCase();
  return {
    payer,
    network,
    amountAtomic: parsed.authorization.value,
    fingerprint: sha256Hex(`${network}:${payer}:${parsed.authorization.nonce.toLowerCase()}`),
  };
}

export function identityFromHeader(header: string): PaymentIdentity {
  return identityFromPayload(decodePaymentSignatureHeader(header));
}
