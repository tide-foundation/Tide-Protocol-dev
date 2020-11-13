import Vue from "vue";
import Vuex from "vuex";
import router from "../router";

import Tide from "../../../../Tide.Js/src/export/TideAuthentication";
import request from "superagent";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    initialized: false,
    mode: "Frontend",
    orks: [],
    vendorUrl: null,
    vendorPublic: null,
    vendorServer: null,
    homeUrl: null,
    debug: false,
    tide: null,
    loading: {
      active: false,
      text: "Loading...",
    },
    action: "",
    goToDashboard: false,
    account: null,
  },
  mutations: {
    UPDATE_MODE(state, newMode) {
      state.mode = newMode;
    },
    UPDATE_LOADING(state, data) {
      state.loading = data;
    },
  },
  actions: {
    async initializeTide(context, data) {
      context.state.initialized = true;
      context.state.vendorUrl = data.vendorUrl;
      context.state.vendorPublic = data.vendorPublic;
      context.state.vendorServer = data.serverUrl;
      context.state.orks = data.orks;
      context.state.debug = data.debug;

      context.state.tide = new Tide("VendorId", data.vendorUrl, data.orks, data.vendorPublic);

      // if (!context.state.tide.validateReturnUrl(window.name, data.hashedReturnUrl)) {
      //   return window.opener.postMessage({ type: "tide-failed", data: { error: "Failed to validate returnUrl" } }, window.name);
      // }

      router.push("/auth");
    },
    async checkForValidUsername(context, username) {
      return context.state.tide.checkForValidUsername(username);
    },
    async changeOrkWindow(context, newOrk) {
      const data = { newOrk };
      window.opener.postMessage({ type: "tide-change-ork", data }, window.name);
    },
    async registerAccount(context, user) {
      this.action = "Register";
      this.goToDashboard = user.goToDashboard;
      const serverTime = (await request.get(`${context.state.vendorServer}/tide-utility/servertime`)).text;

      const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      var isEmail = re.test(String(user.username).toLowerCase());

      context.state.account = await context.state.tide.registerJwt(user.username, user.password, isEmail ? user.username : "noemail@noemail.com", context.state.orks, serverTime, Math.floor((context.state.orks / 3) * 2));
      return context.state.account;
    },
    async loginAccount(context, user) {
      this.action = "Login";
      this.goToDashboard = user.goToDashboard;
      const serverTime = (await request.get(`${context.state.vendorServer}/tide-utility/servertime`)).text;
      context.state.account = await context.state.tide.loginJwt(user.username, user.password, serverTime);
      return context.state.account;
    },
    async sendRecoverEmails(context, user) {
      await context.state.tide.recover(user.username, context.getters.orks);
    },
    async reconstructAccount(context, data) {
      await context.state.tide.reconstruct(data.username, data.shares, data.newPass, context.getters.orks);
    },
    async changePassword(context, user) {
      await context.state.tide.changePassword(user.password, user.newPassword, context.getters.orks);
    },
    async finalizeAuthentication(context, data) {
      data.vuid = data.vuid.toString();
      data.action = this.action;
      data.autoClose = !this.goToDashboard;
      data.action = window.opener.postMessage({ type: "tide-authenticated", data }, window.name);

      if (this.goToDashboard) router.push("/account");
    },
  },
  modules: {},
  getters: {
    mode: (state) => state.mode,
    loading: (state) => state.loading,
    vendorUrl: (state) => state.vendorUrl,
    orks: (state) => state.orks,
    username: (state) => state.username,
    isInitialized: (state) => state.initialized,
    isLoggedIn: (state) => true,
    account: (state) => state.account,
    debug: (state) => state.debug,
  },
});
