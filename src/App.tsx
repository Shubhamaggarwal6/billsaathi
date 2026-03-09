import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "@/contexts/AppContext";
import MobileInstallBanner from "@/components/MobileInstallBanner";
import OfflineBanner from "@/components/OfflineBanner";
import Index from "./pages/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineBanner />
      <AppProvider>
        <MobileInstallBanner />
        <Index />
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
