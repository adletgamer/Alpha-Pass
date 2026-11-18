import { HomePage } from "@/components/home/HomePage";
import { homeMetadata } from "@/components/home/home-metadata";

export const metadata = homeMetadata("en");

export default function Page() {
  return <HomePage locale="en" />;
}
