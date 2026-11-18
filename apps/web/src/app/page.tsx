import { HomePage } from "@/components/home/HomePage";
import { homeMetadata } from "@/components/home/home-metadata";

export const metadata = homeMetadata("es");

export default function Page() {
  return <HomePage locale="es" />;
}
