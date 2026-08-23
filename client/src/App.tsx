import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AnimatePresence, motion } from "framer-motion";
import MainLayout from "./components/MainLayout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Community from "./pages/Community";
import AIDiscovery from "./pages/AIDiscovery";
import Profile from "./pages/Profile";
import InitiativeDetail from "./pages/InitiativeDetail";
import Admin from "./pages/Admin";
import OrganizationProfile from "./pages/OrganizationProfile";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function Router() {
  return (
    <AnimatePresence mode="wait">
      <Switch>
        <Route path="/">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Home />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/explore">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Explore />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/community">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Community />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/ai-discovery">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <AIDiscovery />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/profile">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Profile />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/initiative/:id">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <InitiativeDetail />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/organization/:id">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <OrganizationProfile />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/admin">
          <MainLayout>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Admin />
            </motion.div>
          </MainLayout>
        </Route>
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
