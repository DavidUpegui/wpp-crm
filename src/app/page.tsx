import { redirect } from "next/navigation";

const HOME_PATH = "/inbox";

/**
 * `/` has no content of its own: it opens the inbox. Visitors without a
 * session are sent to the login screen by the proxy and the app layout.
 */
export default function RootPage(): never {
  redirect(HOME_PATH);
}
