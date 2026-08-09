import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isLoginPage = createRouteMatcher(["/login"]);
// Landing, login, public profiles, the offline timer, and the service
// worker's offline fallback page are open to signed-out visitors.
// /app is the local-first timer: it works with no login (state is keyed by
// an anonymous id and merged on sign-in), so it must not bounce to /login.
const isPublicPage = createRouteMatcher([
  "/",
  "/login",
  "/app",
  "/leaderboard",
  "/api/feed",
  "/u/(.*)",
  "/offline",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (isLoginPage(request) && authenticated) {
    return nextjsMiddlewareRedirect(request, "/app");
  }
  if (!isPublicPage(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
