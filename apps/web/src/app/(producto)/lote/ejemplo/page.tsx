import { redirect } from "next/navigation";
import { PUBLIC_TESTNET_LOT_PATH } from "@/lib/sample-data";

export default function ExamplePassport() {
  redirect(PUBLIC_TESTNET_LOT_PATH);
}
