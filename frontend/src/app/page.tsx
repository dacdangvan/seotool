/**
 * Home Page - Redirect to Dashboard
 *
 * v0.7 - Main entry point redirects to dashboard
 */

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
