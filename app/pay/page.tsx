import { redirect } from "next/navigation";

// "Pay" and "Payments" were the same job; the app now has one Payments page.
export default function Pay() {
  redirect("/payments");
}
