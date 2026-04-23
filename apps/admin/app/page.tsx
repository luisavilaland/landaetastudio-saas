import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminHome() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white sm:items-start">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-lg text-zinc-600">Bienvenido al panel de administración</p>
      </main>
    </div>
  );
}