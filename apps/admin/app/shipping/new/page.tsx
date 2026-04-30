import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ShippingForm } from "@/components/shipping-form";

export default async function NewShippingMethodPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <ShippingForm mode="create" />;
}
