﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Tide.Core;
using Tide.Simulator.Classes;
using Tide.Simulator.Models;
// ReSharper disable InconsistentlySynchronizedField

namespace Tide.Simulator.Controllers {
    [ApiController]
    [Route("[controller]")]
    public class SimulatorController : ControllerBase
    {
        private readonly IBlockLayer _blockchain;

        private static readonly object WriteLock = new object();

        public SimulatorController(IBlockLayer blockchain)
        {
            _blockchain = blockchain;
        }

        [HttpGet("{contract}/{table}/{scope}")]
        public IActionResult Get([FromRoute] string contract, string table, string scope)
        {
            return Ok(_blockchain.Read(contract, table, scope));
        }

        [HttpGet("{contract}/{table}/{scope}/{index}")]
        public IActionResult Get([FromRoute] string contract, string table, string scope, string index) {

          //  var tran =_blockchain.Read(contract, table, scope, index);
          

            return Ok(_blockchain.Read(contract, table, scope, index));
        }

        [HttpGet("{contract}/{table}/{scope}/{column}/{value}")]
        public IActionResult Get([FromRoute] string contract, string table, string scope, string column,string value)
        {
            return Ok(_blockchain.Read(contract, table, scope, new KeyValuePair<string, string>(column,value)));
        }

        [HttpPost]
        public IActionResult Post([FromBody] Transaction payload)
        {
            lock (WriteLock) {
                return Ok(_blockchain.Write(payload));
            }
        }

        [HttpDelete("{contract}/{table}/{scope}/{index}")]
        public IActionResult Delete([FromRoute] string contract, string table, string scope, string index)
        {
            lock (WriteLock)
            {
                return Ok(_blockchain.SetStale(contract, table, scope, index));
            }
        }

        ////[Authorize]
        //// ORK CALL
        //[HttpPost("Vault/{orkNode}/{username}")]
        //public TideResponse PostVault([FromRoute] string ork, string username, [FromBody] string payload)
        //{
        //    lock (WriteLock)
        //    {
        //        if (!GetUser(username, out var user)) return new TideResponse("That username does not exist");

        //        var desiredOrk = user.Nodes.FirstOrDefault(o => o.Ork == ork);
        //        if (desiredOrk == null) return new TideResponse("You are not a desired OrkNode node. OrkNode: " + ork);

        //        desiredOrk.Confirmed = true;

        //        var transactions = new List<Transaction> {
        //            new Transaction(Contract.Authentication, Table.Vault, ork, username, payload),
        //            new Transaction(Contract.Authentication, Table.Users, Contract.Authentication.ToString(), username, JsonConvert.SerializeObject(user))
        //        };

        //        //var transactions = new List<Transaction> {
        //        //    new Transaction(Contract.Authentication, Table.Vault, orkNode, username, payload),
        //        //   // new Transaction(Contract.Authentication, Table.Users, Contract.Authentication.ToString(), username, JsonConvert.SerializeObject(user))
        //        //};

        //        //if (HttpContext.User.Identity.Name != orkNode) return Unauthorized("You do not have write privileges to that scope.");
        //        return _blockchain.Write(transactions) ? new TideResponse() : new TideResponse("Internal Server Error");
        //    }
        //}

        //  #region Onboarding



        //// CLIENT CALL
        //[HttpGet("GetUserNodes/{username}")]
        //public ActionResult GetUserNodes([FromRoute] string username)
        //{
        //    if (!GetUser(username, out var user)) return Conflict("That username does not exists");
        //    return Ok(user.Nodes);
        //}

        //// VENDOR CALL
        //[HttpPost("CreateUser/{username}")]
        //public ActionResult CreateUser([FromRoute] string username,  [FromBody] List<string> desiredOrks)
        //{
        //    if (!Request.Headers.ContainsKey("VendorId")) return BadRequest("Missing 'VendorId' header");
        //    if (GetUser(username, out var user)) return Conflict("That username already exists");

        //    var newUser = new User
        //    {
        //        Vendor = Request.Headers["VendorId"]
        //    };

        //    foreach (var desiredOrk in desiredOrks)
        //    {
        //        newUser.Nodes.Add(new OrkStatus() { Ork = desiredOrk });
        //    }

        //    return SetUser(username, newUser) ? Ok() : StatusCode(500);
        //}

        //// VENDOR CALL
        //[HttpGet("ConfirmUser/{username}")]
        //public ActionResult ConfirmUser([FromRoute] string username)
        //{
        //    if (!Request.Headers.ContainsKey("VendorId")) return BadRequest("Missing 'VendorId' header");
        //    if (!GetUser(username, out var user)) return BadRequest("That username does not exist");

        //    if (user.Vendor != Request.Headers["VendorId"]) return BadRequest("You are not the authorized vendor");
        //    if (user.Status != UserStatus.Pending) return BadRequest("That user is not in the pending state");

        //    if (!user.Nodes.All(n => n.Confirmed)) return BadRequest("All orkNode nodes have not been confirmed");

        //    user.Status = UserStatus.Active;

        //    return SetUser(username, user) ? Ok() : StatusCode(500);
        //}

        //// VENDOR CALL
        //[HttpDelete("RollbackUser/{username}")]
        //public ActionResult RollbackUser([FromRoute] string username)
        //{
        //    if (!GetUser(username, out var user)) return BadRequest("That username does not exist");

        //    if (user.Status != UserStatus.Pending) return BadRequest("Only pending users can be rolled back");

        //    return _blockchain.SetStale(Contract.Authentication, Table.Users, Contract.Authentication.ToString(), username) ? Ok() : StatusCode(500);
        //}

        //[HttpGet("Vault/{orkNode}/{username}")]
        //public TideResponse GetVault([FromRoute] string ork, string username)
        //{
        //    var result = _blockchain.Read(Contract.Authentication, Table.Vault, ork, username);
        //    if (string.IsNullOrEmpty(result)) return new TideResponse("Invalid username");
        //    return new TideResponse(true,result,null);
        //}

        ////[Authorize]
        //// ORK CALL
        //[HttpPost("Vault/{orkNode}/{username}")]
        //public TideResponse PostVault([FromRoute] string ork, string username, [FromBody] string payload)
        //{
        //    lock (WriteLock)
        //    {
        //        if (!GetUser(username, out var user)) return new TideResponse("That username does not exist");

        //        var desiredOrk = user.Nodes.FirstOrDefault(o => o.Ork == ork);
        //        if (desiredOrk == null) return new TideResponse("You are not a desired OrkNode node. OrkNode: " + ork);

        //        desiredOrk.Confirmed = true;

        //        var transactions = new List<Transaction> {
        //            new Transaction(Contract.Authentication, Table.Vault, ork, username, payload),
        //            new Transaction(Contract.Authentication, Table.Users, Contract.Authentication.ToString(), username, JsonConvert.SerializeObject(user))
        //        };

        //        //var transactions = new List<Transaction> {
        //        //    new Transaction(Contract.Authentication, Table.Vault, orkNode, username, payload),
        //        //   // new Transaction(Contract.Authentication, Table.Users, Contract.Authentication.ToString(), username, JsonConvert.SerializeObject(user))
        //        //};

        //        //if (HttpContext.User.Identity.Name != orkNode) return Unauthorized("You do not have write privileges to that scope.");
        //        return _blockchain.Write(transactions) ? new TideResponse() : new TideResponse("Internal Server Error");
        //    }
        //}

        //#endregion

        //#region Orks

        //// ORK CALL
        //[HttpPost("RegisterOrk")]
        //public ActionResult RegisterOrk([FromBody] OrkNode orkNode) {

        //    var currentOrk = _blockchain.Read(Contract.Authentication, Table.Orks, Contract.Authentication.ToString(), orkNode.Id);
        //    if (currentOrk != null) return Conflict();

        //    var transaction = new Transaction(Contract.Authentication, Table.Orks, Contract.Authentication.ToString(),orkNode.Id, JsonConvert.SerializeObject(orkNode));

        //    return _blockchain.Write(transaction) ? Ok() : StatusCode(500);
        //}

        //// ORK CALL
        //[HttpGet("GetOrks")]
        //public TideResponse GetOrks()
        //{
        //    var orks = _blockchain.Read(Contract.Authentication, Table.Orks, Contract.Authentication.ToString());
        //    return new TideResponse(true,JsonConvert.SerializeObject(orks),null);
        //}

        //#endregion


        //#region Helpers

        //private bool GetUser(string username, out User user)
        //{
        //    user = null;
        //    var data = _blockchain.Read(Contract.Authentication, Table.Users, Contract.Authentication.ToString(), username);

        //    if (data == null) return false;

        //    user = JsonConvert.DeserializeObject<User>(data);
        //    return true;
        //}

        //private bool SetUser(string username, User user)
        //{
        //    return _blockchain.Write(new Transaction(Contract.Authentication, Table.Users, Contract.Authentication.ToString(), username, JsonConvert.SerializeObject(user)));
        //}

        //#endregion
    }
}
