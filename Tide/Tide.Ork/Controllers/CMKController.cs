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

using System;
using System.Linq;
using System.Numerics;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Tide.Core;
using Tide.Encryption.AesMAC;
using Tide.Encryption.Ecc;
using Tide.Encryption.Ed;
using Tide.Encryption.Tools;
using Tide.Encryption.SecretSharing;
using Tide.Ork.Classes;
using Tide.Ork.Components.AuditTrail;
using Tide.Ork.Models;
using Tide.Ork.Repo;
using System.Collections.Generic;

namespace Tide.Ork.Controllers
{
    [ApiController]
    [Route("api/cmk")]
    public class CMKController : ControllerBase
    {
        private readonly IEmailClient _mail;
        private readonly LoggerPipe _logger;
        private readonly ICmkManager _manager;
        private readonly OrkConfig _config;

        public CMKController(IKeyManagerFactory factory, IEmailClient mail, ILogger<CMKController> logger, OrkConfig config, Settings settings)
        {
            _manager = factory.BuildCmkManager();
            _mail = mail;
            _logger = new LoggerPipe(logger, settings, new LoggerConfig());
            _config = config;
        }

        //TODO: Move secrets out of the url
        //TODO: there is not verification if the account already exists
        [HttpPut("{uid}/{prism}/{cmk}/{prismAuth}/{cmkAuth}/{email}")]
        public async Task<TideResponse> Add([FromRoute] Guid uid, [FromRoute] string prism, [FromRoute] string cmk, [FromRoute] string prismAuth, [FromRoute] string cmkAuth, [FromRoute] string email)
        {
            _logger.LogInformation($"New registration for {uid}", uid);
            var account = new CmkVault
            {
                UserId = uid,
                Prismi = GetBigInteger(prism),
                Cmki = GetBigInteger(cmk),
                PrismiAuth = AesKey.Parse(FromBase64(prismAuth)),
                CmkiAuth = AesKey.Parse(FromBase64(cmkAuth)),
                Email = HttpUtility.UrlDecode(email)
            };

            var resp = await _manager.Add(account);
            if (!resp.Success) {
                _logger.LogInformation($"CMK was not added for uid '{uid}'");
                return resp;
            }
            
            var m = Encoding.UTF8.GetBytes(_config.UserName + uid.ToString());
            //TODO: The ork should not send the orkid because the client should already know
            var signature = Convert.ToBase64String(_config.PrivateKey.EdDSASign(m));
            resp.Content = new { orkid = _config.UserName, sign = signature };
            
            return resp;
        }

        [HttpGet("random/{uid}")]
        public ActionResult<RandomResponse> GetRandom([FromQuery] Ed25519Point pass, [FromQuery] Ed25519Point vendor, [FromQuery] ICollection<Guid> ids)
        {
            if (pass is null || vendor is null ) {
                _logger.LogDebug("Random: The pass and vendor arguments are required");
                return BadRequest($"The pass and vendor arguments are required");
            }
          
            if (ids == null || ids.Count < _config.Threshold) {
                _logger.LogInformation("Random: The length of the ids ({length}) must be greater than or equal to {threshold}", ids?.Count, _config.Threshold);
                return BadRequest($"The length of the ids must be greater than {_config.Threshold -1}");
            }

            if (!ids.Contains(_config.Guid)) ids.Add(_config.Guid);
            
            var idValues = ids.Select(id => new BigInteger(id.ToByteArray(), true, true)).ToList();
            if (idValues.Any(id => id == 0)) {
                _logger.LogInformation("Random: Ids cannot contain the value zero");
                return BadRequest($"Ids cannot contain the value zero");
            }

            if (!pass.IsValid() || !vendor.IsValid())
            {
                _logger.LogInformation($"Random: The pass and vendor arguments must be a valid point");
                return BadRequest("The pass and vendor arguments must be a valid point");
            }
           
            BigInteger prismi, cmki ,cmk2i;
            using (var rdm = new RandomField(Ed25519.N))
            {
                prismi = rdm.Generate(BigInteger.One);
                cmki = rdm.Generate(BigInteger.One);
                cmk2i = rdm.Generate(BigInteger.One);
            }

            _logger.LogInformation("CMki: " + cmki.ToString());

            var gPassPrismi = pass * prismi;
            var cmkPubi =  Ed25519.G * cmki;
            var cmkPub2i = Ed25519.G * cmk2i;
            var vendorCMKi  = vendor * cmki;
            var prisms = EccSecretSharing.Share(prismi, idValues, _config.Threshold, Ed25519.N);
            var cmks = EccSecretSharing.Share(cmki, idValues, _config.Threshold, Ed25519.N);
            var cmk2s = EccSecretSharing.Share(cmk2i, idValues, _config.Threshold, Ed25519.N);
            
            _logger.LogInformation("Random: Generating random for [{orks}]", string.Join(',', ids));
            return new RandomResponse(_config.UserName, gPassPrismi, cmkPubi, cmkPub2i, vendorCMKi, prisms, cmki, cmks, cmk2s);
        }

        [HttpPut("random/{uid}/{partialCmkPub}/{partialCmk2Pub}")] // Also provide cmkPub and cmk2Pub points from function above (so these are non threshold)
        // Also provide a partial DnsEntry for us to sign. It has to be partial because we don't have all the fields e.g. signatures
        // But we do have the fields we sign e.g. orkIDs and cmkPub, so it's possible
        public async Task<ActionResult<AddRandomResponse>> AddRandom([FromRoute] Guid uid, [FromRoute] Ed25519Point partialCmkPub, [FromRoute] Ed25519Point partialCmk2Pub, [FromBody] RandRegistrationReq rand, [FromQuery] string li = null)
        {
            _logger.LogInformation("Underprepared Dns Entry: " + rand.entry);


            if (uid == Guid.Empty) {
                _logger.LogDebug("AddRandom: The uid must not be empty");
                return BadRequest($"The uid must not be empty");
            }

            if (rand is null || rand.Shares is null  || rand.Shares.Length < _config.Threshold) {
                var args = new object[] { rand?.Shares?.Length, _config.Threshold };
                _logger.LogInformation("AddRandom: The length of the shares [length] must be greater than or equal to {threshold}", args);
                return BadRequest($"The length of the ids must be greater than {_config.Threshold -1}");
            }

            if (rand.Shares.Any(shr => shr.Id != _config.Guid)) {
                var i = string.Join(',', rand.Shares.Select(shr => shr.Id).Where(id => id != _config.Guid));
                _logger.LogCritical("AddRandom: Shares were sent to the wrong ORK: {ids}", i);
                return BadRequest($"Shares were sent to the wrong ORK: '{i}'");
            }

            var lagrangian = BigInteger.Zero;
            if (!string.IsNullOrWhiteSpace(li) && !BigInteger.TryParse(li, out lagrangian))
            {
                _logger.LogInformation("AddRandom: Invalid li for {uid}: '{li}' ", uid, li);
                return BadRequest("Invalid parameter li");
            }

            var isNew = !await _manager.Exist(uid);
            if (!isNew) {
                _logger.LogInformation("AddRandom: CMK already exists for {uid}", uid);
                return BadRequest("CMK already exists");
            }

            var account = new CmkVault
            {
                UserId = uid,
                Email = rand.Email,
                Cmki = rand.ComputeCmk(),
                Prismi = rand.ComputePrism(),
                PrismiAuth = rand.PrismAuth,
                Cmk2i = rand.ComputeCmk2()
            };

            _logger.LogInformation(rand.GetCmki().ToString());

            _logger.LogInformation("Publicx: " + (partialCmkPub + (Ed25519.G * rand.GetCmki())).GetX());
            _logger.LogInformation("Publicy: " + (partialCmkPub + (Ed25519.G * rand.GetCmki())).GetY());


            // find the rand value which has this ork's id.
            // use that to make a signautre with
            // s = sign( rand.cmk(orkid) , rand.cmk2(orkid) , cmkPub, cmk2Pub, dnsEntry)

            var resp = await _manager.Add(account);
            if (!resp.Success) {
                _logger.LogInformation($"AddRandom: CMK was not added for uid '{uid}'");
                return Problem(resp.Error);
            }
            
            _logger.LogInformation($"AddRandom: New registration for {uid}", uid);
            var m = Encoding.UTF8.GetBytes(_config.UserName + uid.ToString());

            var token = new TranToken();
            token.Sign(_config.SecretKey); // token client will use to authetnicate on SignEntry endpoint
            return new AddRandomResponse
            {
                CmkPub = Ed25519.G * (rand.ComputeCmk() * lagrangian),
                Cmk2Pub = Ed25519.G * (rand.ComputeCmk2() * lagrangian),
                Signature = new { orkid = _config.UserName, sign = Convert.ToBase64String(_config.PrivateKey.EdDSASign(m))}, // OrkSign type
                EncryptedToken = account.PrismiAuth.Encrypt(token.ToByteArray())
            };
        }

        //TODO: Add throttling by ip and account separate
        [HttpGet("sign/{uid}/{token}/{partialCmkPub}/{partialCmk2Pub}")]
        public async Task<ActionResult<String>> SignEntry([FromRoute] Guid uid, [FromRoute] string token, [FromRoute] Ed25519Point partialCmkPub, [FromRoute] Ed25519Point partialCmk2Pub, [FromBody] DnsEntry entry, [FromQuery] Guid tranid, [FromQuery] string li = null)
        {
            if (!token.FromBase64UrlString(out byte[] bytesToken))
            {
                _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"SignEntry: Invalid token format for {uid}");
                return Unauthorized();
            }

            var lagrangian = BigInteger.Zero;
            if (!string.IsNullOrWhiteSpace(li) && !BigInteger.TryParse(li, out lagrangian))
            {
                _logger.LogInformation("SignEntry: Invalid li for {uid}: '{li}' ", uid, li);
                return BadRequest("Invalid parameter li");
            }

            var tran = TranToken.Parse(bytesToken);
            var account = await _manager.GetById(uid);
            if (account == null || tran == null || !tran.Check(_config.SecretKey)) { // checking that this ork was the one who signed this token (timestamp pretty much)
                if (account == null)
                    _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"SignEntry: Account {uid} does not exist");
                else
                    _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"SignEntry: Invalid token for {uid}");

                return Unauthorized("Invalid account or signature");
            }
            
            if (!tran.OnTime) {
                _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"SignEntry: Expired token for {uid}");
                return StatusCode(418, new TranToken().ToString());
            }
            
            var cmkPub = partialCmkPub + (Ed25519.G * (account.Cmki * lagrangian));
            var cmk2Pub = partialCmk2Pub + (Ed25519.G * (account.Cmk2i * lagrangian));

            var s = Ed25519Dsa.Sign(account.Cmk2i * lagrangian, account.Cmki * lagrangian, cmkPub, cmk2Pub, entry.MessageSignedBytes());

            return s.ToString(); // signature
        }

        [MetricAttribute("prism")]
        [ThrottleAttribute("uid")]
        [HttpGet("prism/{uid}/{pass}")]
        public async Task<ActionResult<ApplyResponse>> Apply([FromRoute] Guid uid, [FromRoute] string pass, [FromQuery] string li = null)
        {
            if (!pass.FromBase64UrlString(out byte[] bytesPass)) {
                _logger.LogInformation($"Apply: Invalid pass for {uid}");
                return BadRequest("Invalid parameters");
            }

            var lagrangian = BigInteger.Zero;
            if (!string.IsNullOrWhiteSpace(li) && !BigInteger.TryParse(li, out lagrangian)) {
                _logger.LogInformation("Apply: Invalid li for {uid}: '{li}' ", uid, li);
                return BadRequest("Invalid parameter li");
            }

            Ed25519Point g;
            try
            {
                g = Ed25519Point.From(bytesPass);
                if (!g.IsValid()) {
                   _logger.LogInformation($"Apply: Invalid point for {uid}");
                    return BadRequest("Invalid parameters");
                }
            }
            catch (ArgumentException)
            {
                _logger.LogInformation($"Apply: Invalid point for {uid} with error");
                return BadRequest("Invalid parameters");
            }

            var s = await _manager.GetPrism(uid);
            if (s == BigInteger.Zero) {
                _logger.LogInformation($"Apply: Account {uid} does not exist");
                return BadRequest("Invalid parameters");
            }

            var gs = lagrangian <= 0 ? g * s : g * (s *  lagrangian).Mod(Ed25519.N);

            _logger.LogInformation($"Login attempt for {uid}", uid, pass);
            return new ApplyResponse
            {
                Prism = gs.ToByteArray(),
                Token = new TranToken().ToByteArray()
            };
        }

        //TODO: Add throttling by ip and account separate
        [MetricAttribute("cmk", recordSuccess:true)]
        [HttpGet("auth/{uid}/{point}/{token}")]
        public async Task<ActionResult> Authenticate([FromRoute] Guid uid, [FromRoute] Ed25519Point point, [FromRoute] string token, [FromQuery] Guid tranid, [FromQuery] string li = null)
        {
            if (!token.FromBase64UrlString(out byte[] bytesToken))
            {
                _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"Authenticate: Invalid token format for {uid}");
                return Unauthorized();
            }

            var lagrangian = BigInteger.Zero;
            if (!string.IsNullOrWhiteSpace(li) && !BigInteger.TryParse(li, out lagrangian))
            {
                _logger.LogInformation("Apply: Invalid li for {uid}: '{li}' ", uid, li);
                return BadRequest("Invalid parameter li");
            }

            var tran = TranToken.Parse(bytesToken);
            var account = await _manager.GetById(uid);
            if (account == null || tran == null || !tran.Check(account.PrismiAuth, uid.ToByteArray())) {
                if (account == null)
                    _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"Authenticate: Account {uid} does not exist");
                else
                    _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"Authenticate: Invalid token for {uid}");

                return Unauthorized("Invalid account or signature");
            }
            
            if (!tran.OnTime) {
                _logger.LoginUnsuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"Authenticate: Expired token for {uid}");
                return StatusCode(418, new TranToken().ToString());
            }

            _logger.LoginSuccessful(ControllerContext.ActionDescriptor.ControllerName, tranid, uid, $"Authenticate: Successful login for {uid}");
            var cvkAuthi = (lagrangian <= 0 ? point * account.Cmki : point * (account.Cmki * lagrangian).Mod(Ed25519.N)).ToByteArray();
            return Ok(account.PrismiAuth.EncryptStr(cvkAuthi));
        }

        [HttpPost("prism/{uid}/{prism}/{prismAuth}/{token}")]
        public async Task<ActionResult> ChangePrism([FromRoute] Guid uid, [FromRoute] string prism, [FromRoute] string prismAuth, [FromRoute] string token, [FromQuery] bool withCmk = false)
        {
            var tran = TranToken.Parse(FromBase64(token));
            var toCheck = uid.ToByteArray().Concat(FromBase64(prism)).Concat(FromBase64(prismAuth)).ToArray();

            var account = await _manager.GetById(uid);
            if (account == null)
                return _logger.Log(Unauthorized($"Unsuccessful change password for {uid}"),
                    $"Unsuccessful change password for {uid}. Account was not found");

            var authKey = withCmk ? account.CmkiAuth : account.PrismiAuth;
            if (!tran.Check(authKey, toCheck))
                return _logger.Log(Unauthorized($"Unsuccessful change password for {uid}"),
                    $"Unsuccessful change password for {uid} with {token}");

            _logger.LogInformation($"Change password for {uid}", uid);

            account.Prismi = GetBigInteger(prism);
            account.PrismiAuth = AesKey.Parse(FromBase64(prismAuth));

            await _manager.SetOrUpdate(account);
            return Ok();
        }

        //TODO: Make it last temporarily
        //TODO: Encrypt data with a random key
        [HttpGet("mail/{uid}")]
        public async Task<ActionResult> Recover([FromRoute] Guid uid)
        {
            var account = await _manager.GetById(uid);
            var share = new OrkShare(_config.Id, account.Cmki).ToString();
            var msg = $"You have requested to recover the CMK. Introduce the code [{share}] into tide wallet.";

            _mail.SendEmail(uid.ToString(), account.Email, "Key Recovery", msg);
            _logger.LogInformation($"Send cmk share to {uid}", uid);

            return Ok();
        }

        [HttpPost("{uid}")]
        public async Task<ActionResult> Confirm([FromRoute] Guid uid)
        {
            await _manager.Confirm(uid);
            _logger.LogInformation($"Confimed user {uid}", uid);
            return Ok();
        }

        private byte[] FromBase64(string input)
        {
            return Convert.FromBase64String(input.DecodeBase64Url());
        }

        private BigInteger GetBigInteger(string number)
        {
            return new BigInteger(FromBase64(number), true, true);
        }
    }
}