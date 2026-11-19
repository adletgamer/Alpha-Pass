import { SiteHeader } from "@/components/SiteHeader";
import { TestnetWalletProvider } from "@/components/TestnetWallet";

// Layout de la app del prototipo (cooperativa, importador, verificador, pasaporte).
// Las URLs no cambian: el grupo (producto) no aparece en la ruta.
export default function ProductoLayout({ children }: { children: React.ReactNode }) {
  return (
    <TestnetWalletProvider>
      <SiteHeader />
      {children}
    </TestnetWalletProvider>
  );
}
