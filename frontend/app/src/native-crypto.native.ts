import { install } from "react-native-quick-crypto";

/**
 * Hermes has no WebCrypto. This gives the phone a native `crypto.subtle` (react-native-quick-crypto)
 * so the encryption library can run (docs/E2EE.md, phase 1). Imported first, before anything else.
 */
install();
