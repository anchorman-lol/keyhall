import * as nip44 from "nostr-tools/nip44";
import { finalizeEvent } from "nostr-tools/pure";
import type { UserSigner } from "./presence";

export function signerFor(secret: Uint8Array): UserSigner {
  return {
    signEvent: async (t) => finalizeEvent(t, secret),
    nip44Encrypt: async (pubkey, text) =>
      nip44.encrypt(text, nip44.getConversationKey(secret, pubkey)),
    nip44Decrypt: async (pubkey, text) =>
      nip44.decrypt(text, nip44.getConversationKey(secret, pubkey)),
  };
}
