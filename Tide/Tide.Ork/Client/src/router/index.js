import Vue from "vue";
import VueRouter from "vue-router";
import Initializing from "../views/Initializing.vue";
import Auth from "../views/Auth.vue";
import Dashboard from "../views/Dashboard.vue";
import Store from "../store/";

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    name: "Initializing",
    component: Initializing,
  },
  {
    path: "/auth",
    name: "Auth",
    component: Auth,
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
    meta: {
      requiresAuth: true,
    },
  },
];

const router = new VueRouter({
  mode: "history",
  base: process.env.BASE_URL,
  routes,
});

router.beforeEach((to, from, next) => {
  if (to.path != "/" && !Store.getters.isInitialized) return next({ name: "Initializing" });
  else if (to.matched.some((record) => record.meta.requiresAuth) && !Store.getters.isLoggedIn) return next("/auth");

  next();
});

export default router;
