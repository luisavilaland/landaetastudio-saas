import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProductForm } from "@/components/product-form";

export default async function NewProductPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <ProductForm mode="create" />;
}