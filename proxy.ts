import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isLoginPage = createRouteMatcher(["/login"]);
// Landing, login, and public profiles are open to signed-out visitors.
const isPublicPage = createRouteMatcher(["/", "/login", "/u/(.*)"]);

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
