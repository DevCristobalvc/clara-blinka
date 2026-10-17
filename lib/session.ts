// Mock login for the hackathon demo. Not real authentication: the cookie only gates the demo workspace.
export const SESSION_COOKIE = "orbit_session";
export const DEMO_USER = "123";
export const DEMO_PASSWORD = "123";

export function isDemoLogin(user: string, password: string) {
  return user.trim() === DEMO_USER && password === DEMO_PASSWORD;
}
