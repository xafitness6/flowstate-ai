// Legacy route — redirects to /admin
import { redirect } from "next/navigation";

export default function MasterRedirect() {
  redirect("/admin");
}
