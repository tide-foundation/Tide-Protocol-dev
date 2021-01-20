// Tide Protocol - Infrastructure for the Personal Data economy
// Copyright (C) 2019 Tide Foundation Ltd
//
// This program is free software and is subject to the terms of
// the Tide Community Open Source License as published by the
// Tide Foundation Limited. You may modify it and redistribute
// it in accordance with and subject to the terms of that License.
// This program is distributed WITHOUT WARRANTY of any kind,
// including without any implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.
// See the Tide Community Open Source License for more details.
// You should have received a copy of the Tide Community Open
// Source License along with this program.
// If not, see https://tide.org/licenses_tcosl-1-0-en

import DCryptClient from "./DCryptClient";
import { C25519Point, AESKey, C25519Key, C25519Cipher, BnInput, SecretShare, AesSherableKey } from "cryptide";
import KeyStore from "../keyStore";
import Cipher from "../Cipher";
import Guid from "../guid";
import { concat } from "../Helpers";
import TranToken from "../TranToken";
import DnsEntry from "../DnsEnrty";
import DnsClient from "./DnsClient";

export default class DCryptFlow {
  /**
   * @param {string[]} urls
   * @param {Guid} user
   */
  constructor(urls, user, memory = false) {
    this.clients = urls.map((url) => new DCryptClient(url, user, memory));
    this.user = user;
  }

  /**
   * @param {AESKey} cmkAuth
   * @param {number} threshold
   * @param {Guid} signedKeyId
   * @param {Uint8Array[]} signatures
   */
  async signUp(cmkAuth, threshold, signedKeyId, signatures, cvk = C25519Key.generate()) {
    try {
      if (!signatures && signatures.length != this.clients.length)
        throw new Error("Signatures are required");

      const ids = await Promise.all(this.clients.map((c) => c.getClientId()));

      const cvks = cvk.share(threshold, ids, true);
      var idBuffers = await Promise.all(this.clients.map((c) => c.getClientBuffer()));
      const cvkAuths = idBuffers.map(buff => concat(buff, this.user.buffer)).map(buff => cmkAuth.derive(buff));

      var orkSigns = await Promise.all(this.clients.map((cli, i) => 
        cli.register(cvk.public(), cvks[i].x, cvkAuths[i], signedKeyId, signatures[i])));

      await this.addDns(orkSigns, cvk);
        
      return cvk;
    } catch (err) {
      throw err;
    }
  }

  /** @private 
   * @param {{orkid: string, sign: string}[]} signatures 
   * @param {C25519Key} key */
  addDns(signatures, key) {
    const cln = this.clients[Math.floor(Math.random() * this.clients.length)];
    const dnsCln = new DnsClient(cln.baseUrl, cln.userGuid);
    var entry = new DnsEntry();
    
    entry.id = cln.userGuid;
    entry.public = key.public()
    entry.signatures = signatures.map(sig => sig.sign);
    entry.orks = signatures.map(sig => sig.orkid);
    entry.sign(key);

    return dnsCln.addDns(entry);
  }

  /** @param {AESKey} cmkAuth */
  async getKey(cmkAuth, noPublic = false) {
    var idBuffers = await Promise.all(this.clients.map((c) => c.getClientBuffer()));
    const cvkAuths = idBuffers.map(buff => concat(buff, this.user.buffer)).map(buff => cmkAuth.derive(buff));

    const tranid = new Guid();
    const cipherCvks = await Promise.all(this.clients.map((c, i) => c.getCvk(tranid, cvkAuths[i])));

    var cvks = cvkAuths.map((auth, i) => auth.decrypt(cipherCvks[i])).map((shr) => BnInput.getBig(shr));

    var ids = await Promise.all(this.clients.map((c) => c.getClientId()));
    var cvk = SecretShare.interpolate(ids, cvks, C25519Point.n);

    return C25519Key.private(cvk, noPublic);
  }

  /**
   * @param {Uint8Array} cipher
   * @param {C25519Key} prv
   */
  async decrypt(cipher, prv) {
    try {
      const keyId = new KeyStore(prv.public()).keyId;
      const challenges = await Promise.all(this.clients.map((cli) => cli.challenge(keyId)));

      const asymmetric = Cipher.asymmetric(cipher);
      const sessionKeys = challenges.map((ch) => prv.decryptKey(ch.challenge));
      const signs = sessionKeys.map((key) => key.hash(asymmetric));

      const ciphers = await Promise.all(this.clients.map((cli, i) => cli.decrypt(asymmetric, keyId, challenges[i].token, signs[i])));

      const ciph = Cipher.cipherFromAsymmetric(asymmetric);
      const partials = ciphers.map((cph, i) => C25519Point.from(sessionKeys[i].decrypt(cph))).map((pnt) => new C25519Cipher(pnt, ciph.c2));

      const ids = await Promise.all(this.clients.map((c) => c.getClientId()));
      const plain = C25519Cipher.decryptShares(partials, ids);

      var symmetric = Cipher.symmetric(cipher);
      if (symmetric.length == 0) {
        return C25519Cipher.unpad(plain);
      }

      const symmetricKey = AesSherableKey.from(plain);
      return symmetricKey.decrypt(symmetric);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  confirm() {
    return Promise.all(this.clients.map(c => c.confirm()));
  }
}
