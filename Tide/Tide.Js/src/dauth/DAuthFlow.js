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
// @ts-check

import bigInt from "big-integer";
import DAuthClient from "./DAuthClient";
import DAuthShare from "./DAuthShare";
import { SecretShare, Utils, AESKey, ed25519Key, ed25519Point, Hash } from "cryptide";
import TranToken from "../TranToken";
import { concat } from "../Helpers";
import { getArray } from "cryptide/src/bnInput";
import DnsEntry from "../DnsEnrty";
import DnsClient from "./DnsClient";
import Guid from "../guid";
import SetClient from "./SetClient";
import RandRegistrationReq from "./RandRegistrationReq";
import { Dictionary } from "../Tools";
import ApplyResponseDecrypted from "./ApplyResponseDecrypted";
import IdGenerator from "../IdGenerator";


export default class DAuthFlow {
  /**
   * @param {string[]} urls
   * @param {string|Guid} user
   */
  constructor(urls, user, memory = false) {
    this.clients = urls.map((url) => new DAuthClient(url, user, memory));
    this.clienSet = new SetClient(this.clients);
    this.userID = typeof user === 'string' ? IdGenerator.seed(user) : new IdGenerator(user); // Needed this out of neccessity
  }

  /**
   * @param {string} password
   * @param {string|string[]} email
   * @param {number} threshold
   * @returns {Promise<AESKey|Error>}
   */
  async signUp(password, email, threshold,  cmk=null, vendor) {
    try {
      if (!email) throw new Error("email must have at least one item");
      const emails = typeof email === "string" ? [email] : email;
      const emailIndex = Math.floor(Math.random() * emails.length);

      const r = random();
      const g = ed25519Point.fromString(password);
      const gR = g.times(r);

      const ids = await this.clienSet.all(cli => cli.getClientId()); 
      const idBuffers = await this.clienSet.map(ids, cli => cli.getClientBuffer());
      const guids = idBuffers.map(buff => new Guid(buff));

      const randoms = await this.clienSet.map(guids, cli => cli.random(gR, vendor, guids.values)); 

      const cmkPub = randoms.values.map(rdm => rdm.cmkPub).reduce((sum, cmki) => cmki.add(sum));

      const cmk2Pub = randoms.values.map(rdm => rdm.cmk2Pub).reduce((sum, cmki) => cmki.add(sum));
      const gRPrism = randoms.values.map(rdm => rdm.password).reduce((sum, gPrismi)=> gPrismi.add(sum));
      const vendorCMK = randoms.values.map(rdm => rdm.vendorCMK).reduce((sum, gPrismi)=> gPrismi.add(sum));
      const cmkis = randoms.map(p => p.cmki_noThreshold); // add ork ID to dictionairies later
      const cmk2is = randoms.map(p => p.cmk2i_noThreshold); // add ork ID to dictionairies later
      const orkIDs = randoms.map(p => p.ork_userName);
      
      const cvkAuth = AESKey.seed(vendorCMK.toArray());

      const rInv = r.modInv(bigInt(ed25519Point.order.toString()));
      const gPrism = gRPrism.times(rInv);
      const prismAuth = AESKey.seed(gPrism.toArray());


      const prismAuths = idBuffers.map(buff => prismAuth.derive(buff)); 

      const entry = this.prepareDnsEntry(cmkPub, orkIDs); ///////////// here is the partial entry
      
      const mails = randoms.map((_, __, i) => emails[(emailIndex + i) % emails.length]);
      const shares = randoms.map((_, key) => randoms.map(rdm => rdm.shares[Number(key)]).values);
      const randReq = randoms.map((_, key) => new RandRegistrationReq(prismAuths.get(key), mails.get(key), cmkis.get(key),cmk2is.get(key), shares.get(key), entry)) // I pass partial entry here

      //// Get lis for randomSignup <- consider finding a way to reuse lis
      const idGens = await this.clienSet.all(c => c.getClientGenerator())
      const idss = idGens.map(idGen => idGen.id);
      const lis = idss.map(id => SecretShare.getLi(id, idss.values, bigInt(ed25519Point.order.toString())));
      ///
      const partialPubs = randoms.map(p => randoms.values.map(p => p.cmkPub).reduce((sum, cmkPubi) => { return cmkPubi.isEqual(p.cmkPub) ? sum : cmkPubi.add(sum)}, ed25519Point.infinity));
      const partialPubs2 = randoms.map(p => randoms.values.map(p => p.cmk2Pub).reduce((sum, cmkPubi) => { return cmkPubi.isEqual(p.cmk2Pub) ? sum : cmkPubi.add(sum)}, ed25519Point.infinity));


      const randSignUpResponses = await this.clienSet.map(randoms, (cli, _, key) => cli.randomSignUp(randReq.get(key), partialPubs.get(key), partialPubs2.get(key), lis.get(key)));
      ///
      const tokens = randSignUpResponses.map(e => e[1]).map((cipher, i) => TranToken.from(prismAuths.get(i).decrypt(cipher))); // works
      const s = randSignUpResponses.values.map(e => e[4]).reduce((sum, sig) => (sum + sig) % ed25519Point.order);
      const signatures = randSignUpResponses.map(e => e[0]);


    await this.addDns(signatures, cmk2Pub,s,entry);

      return cvkAuth;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * 
   * @param {ed25519Point} cmkPub 
   * @param {Dictionary<string>} orkIds 
   * @returns {DnsEntry}
   */
  prepareDnsEntry(cmkPub, orkIds){
    const cln = this.clienSet.get(0); // chnage this later
    const dnsCln = new DnsClient(cln.baseUrl, cln.userGuid); // you have to choose the same ork as the cln later

    const entry = new DnsEntry();
    entry.id = cln.userGuid;
    entry.Public = new ed25519Key(0, cmkPub);
    entry.orks = orkIds.values;

    return entry;
  }

  /**
   * @private 
   * @typedef {import("./DAuthClient").OrkSign} OrkSign
   * @param {OrkSign[] | import("../Tools").Dictionary<OrkSign>} signatures 
   * @param {ed25519Point} cmk2Pub
   * @param {bigint} s
   * @param {DnsEntry} entry*/
  async addDns(signatures, cmk2Pub,s,entry) {
    const keys = Array.isArray(signatures) ? Array.from(signatures.keys()).map(String) : signatures.keys;
    const index = keys[Math.floor(Math.random() * keys.length)];
    const cln = this.clienSet.get(index);
    const dnsCln = new DnsClient(cln.baseUrl, cln.userGuid);

    if (Array.isArray(signatures)) {
      entry.signatures = signatures.map(sig => sig.sign);
      entry.orks = signatures.map(sig => sig.orkid);
    }
    else {
      entry.signatures = signatures.values.map(val => val.sign);
      entry.orks = signatures.values.map(val => val.orkid);
    }
    const signature = ed25519Key.createSig(cmk2Pub, s);
    entry.signature = Buffer.from(signature).toString('base64');
    return dnsCln.addDns(entry);
  }
/**
 * 
 * @param {DnsEntry} entry 
 * @param {import("../Tools").Dictionary<TranToken>} tokens
 * * @param {import("../Tools").Dictionary<ed25519Point>} partialPubs
 * @param {ed25519Point} cmk2Pub
 * @param {import("../Tools").Dictionary<ed25519Point>} partialCmk2Pubs
 * @returns {Promise<Uint8Array>}
 */
  async signEntry(entry, tokens, partialPubs, partialCmk2Pubs, cmk2Pub){
    const idGens = await this.clienSet.all(c => c.getClientGenerator())
    const ids = idGens.map(idGen => idGen.id);
    const lis = ids.map(id => SecretShare.getLi(id, ids.values, bigInt(ed25519Point.order.toString())));

    const tranid = new Guid();
    const signatures = await this.clienSet.map(lis, (cli, li, i) => cli.signEntry(tokens.get(i), tranid, entry, partialPubs.get(i), partialCmk2Pubs.get(i), li));

    // @ts-ignore // says there is error because it doesn't know initial type of sum
    const s = signatures.values.reduce((sum, sig) => (sum + sig) % ed25519Point.order); // todo: add proper mod function here without it being messy

    const signature = ed25519Key.createSig(cmk2Pub, s);
    return signature;
  }

  /**
   * @param {string} password 
   * @param {ed25519Point} point */
  async logIn(password, point) {
    try {
      const [prismAuth, token] = await this.getPrismAuth(password);

      const idGens = await this.clienSet.all(c => c.getClientGenerator())
      const prismAuths = idGens.map(idGen => prismAuth.derive(idGen.buffer));
      // decrypt(timestampi, certTimei) with PristAuthi
      // Add userId timestampi ,certTimei , prismAuthi to verifyi /tokens
      const tokens = idGens.map((_, i) => token.copy().sign(prismAuths.get(i), this.clienSet.get(i).userBuffer))

      //Calculate the deltaTime median(timestami[])-epochtimeUTC() ;( epochtimeUTC() = timestampi ?)

      const tranid = new Guid();
      const ids = idGens.map(idGen => idGen.id);
      const lis = ids.map(id => SecretShare.getLi(id, ids.values, bigInt(ed25519Point.order.toString())));
      // Pass userId , timestampi ,certTimei, verifyi)
      const pre_ciphers = this.clienSet.map(lis, (cli, li, i) => cli.signIn(tranid, tokens.get(i), point, li));

      const cvkAuth = await pre_ciphers.map((cipher, i) => ed25519Point.from(prismAuths.get(i).decrypt(cipher)))
        .reduce((sum, cvkAuthi) => sum.add(cvkAuthi), ed25519Point.infinity);

      // Add a full flow for cmk
      // return S , VUID,timestamp2 for cvk flow
      return AESKey.seed(cvkAuth.toArray());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  

  /** @param {string} pass
   * @returns {Promise<[AESKey, TranToken]>} */
  async getPrismAuth(pass) {
    try {
      const pre_ids = this.clienSet.all(c => c.getClientId());

      const n = bigInt(ed25519Point.order.toString());
      const g = ed25519Point.fromString(pass);
      const r = random();
      const gR = g.times(r);

      const ids = await pre_ids;
      const lis = ids.map((id) => SecretShare.getLi(id, ids.values, n));

      const pre_gRPrismis = this.clienSet.map(lis, (cli, li) => cli.ApplyPrism(gR, li));
      const rInv = r.modInv(n);

      const gRPrism = await pre_gRPrismis.map(ki =>  ki[0])
        .reduce((sum, rki) => sum.add(rki), ed25519Point.infinity);

      const gPrism = gRPrism.times(rInv); 
      const [,token] = await pre_gRPrismis.values[0]; 
      //return the encryped value 

      return [AESKey.seed(gPrism.toArray()), token];
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async logIn2(password, point){
    try {
      var startTimer = Date.now();

      const n = bigInt(ed25519Point.order.toString());

      const [gPassPrism, encryptedResponses, r2Inv, lis] = await this.doConvert(password, point);  //getting r2Inv here is a little messy, but saves a headache
      
      const cln = this.clienSet.get(0); // chnage this later
      const dnsCln = new DnsClient(cln.baseUrl, cln.userGuid);

      const [urls, pubs, cmkpub] = await dnsCln.getInfoOrks(); // pubs is the list of mgOrki
      
      //decryption
      const idGens = await this.clienSet.all(c => c.getClientGenerator()); //find way to only do this once
      const prismAuths = idGens.map(idGen => gPassPrism.derive(idGen.buffer));
      console.log(prismAuths.set(0,AESKey.from("AhBHieFvKLrhBht9DDXAKG+WID9aejrBlFdAm18u0tk4v8foaNV0oUg97fZIi7O0WJDq")));
      console.log(prismAuths.set(1,AESKey.from("AhD+VKUK3pSBjMHNVIhuMAU0IASE7ehWaQFifCVBAWtlQlBWuO5CRo5BXxcIdMHvXuzf")));
      console.log(prismAuths.set(2,AESKey.from("AhD0598tXUsFZjryxiPkp6SzIHkHXIaMx5b0Dr2GvCxrggnwNSF0tZg037eW+M7eCVK9")));

      const decryptedResponses = encryptedResponses.map((cipher, i) => ApplyResponseDecrypted.from(prismAuths.get(i).decrypt(cipher))); // invalid sig
      const gUserCMK = decryptedResponses.map((b, i) => b.gBlurUserCMKi.times(lis.get(i))).reduce((sum, gBlurUserCMKi) => sum.add(gBlurUserCMKi), ed25519Point.infinity).times(r2Inv); // check li worked here
      const gCMK2 = decryptedResponses.map((b, i) => b.gCMK2.times(lis.get(i))).reduce((sum, gCMK2) => sum.add(gCMK2), ed25519Point.infinity); //Correct??
      
      const hash_gUserCMK = Hash.sha512Buffer(gUserCMK.toArray());
      const CMKmul = bigInt_fromBuffer(hash_gUserCMK.subarray(0, 32)); // first 32 bytes
      //const VUID = IdGenerator.seed(hash_gUserCMK.subarray(32, 64)); /// last 32 bytes
      const VUID = new IdGenerator(Guid.from('3672483e-059d-a322-f907-5a4653315d27')); // hardcoded

      const Sesskey = random();
      const gSesskeyPub = ed25519Point.g.times(Sesskey);

      const deltaTime = median(decryptedResponses.map(a => a.certTime.ticks)) - Date.now();
      const timestamp2 = (Date.now() - startTimer) + deltaTime;
      // Begin PreSignInCVK here to save time
      const challenge = {challenge: 'debug this'}; // insert Tide JWT here
      const pre_gCVKR = this.clienSet.map(lis, (dAuthClient, li, i) => dAuthClient.PreSignInCVK(VUID.guid, timestamp2, gSesskeyPub, JSON.stringify(challenge))); // Remove gCmk2 once confirm with the flow

      const gCMKAuth = cmkpub.y.times(CMKmul); // get gCMK from DNS call at beginning

      const r4 = random();
      const r4Inv = r4.modInv(n);
      
      // functional function to append userID bytes to certTime bytes FAST
      const create_payload = (certTime_bytes) => {
        const newArray = new Uint8Array(this.userID.buffer.length + certTime_bytes.length);
        newArray.set(this.userID.buffer);
        newArray.set(certTime_bytes, this.userID.buffer.length);
        return newArray // returns userID + certTime
      }
     
      const VERIFYi = decryptedResponses.map((response, i) => new TranToken().sign(prismAuths.get(i), create_payload(response.certTime.toArray())));
     
      const M = Hash.shaBuffer(timestamp2.toString() + Buffer.from(gSesskeyPub.toArray()).toString('base64')); // TODO: Add point.to_base64 function

      const H = Hash.shaBuffer( Buffer.concat([Buffer.from(gCMKAuth.toArray()), M]));
      const H_int = bigInt_fromBuffer(H);
      const blurHCMKmul = (bigInt_fromBuffer(H).times(CMKmul).times(r4)); // H * CMKmul * r4 % n
     

      const jsonObject = (userID, certTimei, blurHCMKmul) =>  JSON.stringify( { UserId: userID.toString(), CertTime: certTimei.toString(), BlurHCmkMul: blurHCMKmul.toString() } );
      const encAuthRequest = decryptedResponses.map((res, i) => prismAuths.get(i).encrypt(jsonObject(this.userID.guid, res.certTime, blurHCMKmul)).toString('base64'));

      const Encrypted_Auth_Resp = await this.clienSet.map(lis, (dAuthClient, li, i) => dAuthClient.Authenticate(encAuthRequest.get(i), decryptedResponses.get(i).certTime, VERIFYi.get(i),gCMK2)); // Remove gCmk2 once confirm with the flow
      const Decrypted_json = Encrypted_Auth_Resp.values.map((encryptedSi, i) => JSON.parse(prismAuths.get(i).decrypt(encryptedSi).toString())); // decrypt encrypted json from authenticate req
      
      const S = Decrypted_json.map((s, i) => bigInt_fromBuffer(Buffer.from(s.si, 'base64')).times(lis.get(i))).reduce((sum, s) => sum.add(s)).times(r4Inv).mod(n);  // Sum (Si) * r4Inv % n
      const gRmul = Decrypted_json.map((s, i) => ed25519Point.from(Buffer.from(s.gRi, 'base64')).times(lis.get(i))).reduce((sum, s) => sum.add(s), ed25519Point.infinity).times(r4Inv);  // Sum (gRi) * r4Inv % n 

      const string_hash = bigInt_fromBuffer(Hash.sha512Buffer("CMK authentication"));

      if(!ed25519Point.g.times(S).isEqual(gRmul.add(gCMKAuth.times(H_int).times(string_hash)))) {
        return Promise.reject("Ork Blind Signature Invalid")
      }

      const cvkDnsCln = new DnsClient(cln.baseUrl, VUID.guid);
      const [, vIdOrki, ] = await cvkDnsCln.getInfoOrks(); // pubs is the list of mgOrki   TODO: Try to get a Dictinairy here

      const vIds = vIdOrki.map(key => IdGenerator.seed(key.toArray()).id);
      const vLis = vIds.map(id => SecretShare.getLi(id, vIds, n)); // this works

      const ECDHi = vIdOrki.map(pub => AESKey.seed(Hash.shaBuffer(pub.y.times(Sesskey).toArray())));

      const enc_gCVKR = await pre_gCVKR;
      const gCVKR = enc_gCVKR.values.map((enc_gCVKRi, i) => ed25519Point.from(Buffer.from(ECDHi[i].decrypt(enc_gCVKRi), 'base64')).times(vLis[i])).reduce((sum, p) => sum.add(p), ed25519Point.infinity);  //array used. change later

      ///// Tested (everything works i guess) up to here --------

      const encCVKsign = this.clienSet.map(lis, (dAuthClient, li, i) => dAuthClient.SignInCVK(VUID.guid, gRmul, S, timestamp2, gSesskeyPub, JSON.stringify(challenge)));
      
      // find lis for all cvk orks
      const decryptedCVKsign = await encCVKsign.map((enc, i) => JSON.parse(ECDHi[i].decrypt(enc))).map(json => [ed25519Point.from(json.CVKRi), bigInt(json.CVKSi)]) // create list of  [CVKRI, CVKSi]
      // Sum the CVKRis and CVKSis, remember to add li (of cvk orks!)
      const a = 'a';
      return;
    } catch (err) {
      return Promise.reject(err);
    }
  }

    /**
     *  @param {string} pass
     *  @param {ed25519Point} gVVK
     *  @returns {Promise<[AESKey, Dictionary<string>, bigInt.BigInteger, Dictionary<bigInt.BigInteger>]>} // Returns gPassprism + encrypted CMK values + r2Inv (to un-blur gBlurPassPrism)
    */
     async doConvert(pass, gVVK) {
      try {
        const pre_ids = this.clienSet.all(c => c.getClientId());
   
        const n = bigInt(ed25519Point.order.toString());
        const gPass = ed25519Point.fromString(pass);
        const gUser = ed25519Point.fromString(this.userID.guid.toString() + gVVK.toArray().toString()) // replace this with proper hmac + point to hash function

        const r1 = random();
        const r2 = random();

        const gBlurUser = gUser.times(r2);
        const gBlurPass = gPass.times(r1);
  
        const ids = await pre_ids;
        const lis = ids.map((id) => SecretShare.getLi(id, ids.values, n)); // implement method to only use first 14 orks that reply
        const pre_Prismis = this.clienSet.map(lis, (dAuthClient, li) => dAuthClient.Convert(gBlurUser, gBlurPass, li)); // li is not being sent to ORKs. Instead, when gBlurPassPRISM is returned, it is multiplied by li locally
        // would've been neater to do this mutliplication of point * li at gPassRPrism line
                                                                                                               
        const r1Inv = r1.modInv(n);
        const r2Inv = r2.modInv(n);
  
        const gPassRPrism = await pre_Prismis.map(a =>  a[0]) // li has already been multiplied above, so no need to do it here
          .reduce((sum, point) => sum.add(point),ed25519Point.infinity);
      
        const gPassPrism = AESKey.seed(gPassRPrism.times(r1Inv).toArray()); 
        const encryptedResponses = await pre_Prismis.map(a => a[1]);
        
        return [gPassPrism, encryptedResponses, r2Inv, lis];
      } catch (err) {
        return Promise.reject(err);
      }
    }

  Recover() {
    return Promise.all(this.clients.map((cli) => cli.Recover()));
  }

  /**
   * @param {string} textShares
   * @param {string} newPass
   * @param {number} threshold
   */
  async Reconstruct(textShares, newPass = null, threshold = null) {
    var shares = textShares
      .replace(/( +?)|\[|\]/g, "")
      .split(/\r?\n/)
      .map((key) => DAuthShare.from(key));

    var ids = shares.map((c) => c.id);
    var cmks = shares.map((c) => c.share);

    var cmk = SecretShare.interpolate(ids, cmks, bigInt(ed25519Point.order.toString()));
    var cmkAuth = AESKey.seed(Buffer.from(cmk.toArray(256).value));

    if (newPass !== null && threshold !== null) {
      await this.changePassWithKey(cmkAuth, newPass, threshold);
    }

    return cmkAuth;
  }

  /**
   * @param {string} pass
   * @param {string} newPass
   * @param {number} threshold
   */
  async changePass(pass, newPass, threshold) {
    try {
      var [prismAuth] = await this.getPrismAuth(pass);
      await this._changePass(prismAuth, newPass, threshold);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * @param {AESKey} cmkAuth
   * @param {string} pass
   * @param {number} threshold
   */
  changePassWithKey(cmkAuth, pass, threshold) {
    return this._changePass(cmkAuth, pass, threshold, true);
  }

  async confirm() {
    await this.clienSet.all(c => c.confirm());
  }

  /**
   * @param {AESKey} keyAuth
   * @param {string} pass
   * @param {number} threshold
   */
  async _changePass(keyAuth, pass, threshold, isCmk = false) {
    try {
      var prism = random();
      var g = ed25519Point.fromString(pass);
      var prismAuth = AESKey.seed(g.times(prism).toArray());

      var idBuffers = await Promise.all(this.clients.map((c) => c.getClientBuffer()));
      var prismAuths = idBuffers.map((buff) => prismAuth.derive(buff));
      var keyAuths = idBuffers.map((buff) => keyAuth.derive(buff));

      var ids = await Promise.all(this.clients.map((c) => c.getClientId()));
      var [, prisms] = SecretShare.shareFromIds(prism, ids, threshold, bigInt(ed25519Point.order.toString()));

      var tokens = this.clients.map((c, i) => new TranToken().sign(keyAuths[i], concat(c.userBuffer, getArray(prisms[i]), prismAuths[i].toArray())));

      await Promise.all(this.clients.map((cli, i) => cli.changePass(prisms[i], prismAuths[i], tokens[i], isCmk)));
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

/**
 * 
 * @param {Buffer} buffer 
 * @returns 
 */
function bigInt_fromBuffer(buffer){
  var a = Buffer.from(buffer);
  return bigInt.fromArray(Array.from(a.reverse()), 256, false).mod(bigInt(ed25519Point.order.toString()))
}

function random() {
  return Utils.random(bigInt.one, bigInt((ed25519Point.order - BigInt(1)).toString()));
}

function median(numbers) {
  const sorted = Array.from(numbers).sort((a, b) => a.sub(b));
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
      return (sorted[middle - 1]+(sorted[middle])/(2));
  }

  return sorted[middle];
}