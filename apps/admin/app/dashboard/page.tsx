import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  const tenantId = session.user?.tenantId;

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user?.name || session.user?.email}</p>
      <p>Tenant ID: {tenantId || "Not found"}</p>
    </div>
  );
}