import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Ghost, Wallet, Shield, ArrowRight, Loader2 } from "lucide-react";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [sponsorId, setSponsorId] = useState(searchParams.get('ref') || "");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [isLoading, setIsLoading] = useState(false);
  const { user, signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error.message,
      });
    } else {
      // Store role in localStorage for admin access
      localStorage.setItem("userRole", role);
      toast({
        title: "Welcome back!",
        description: "Successfully signed in.",
      });
      // Redirect based on role
      if (role === "admin") {
        navigate("/admin");
      }
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signUp(email, password, fullName, sponsorId || undefined);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      });
    } else {
      // Store role in localStorage for admin access
      localStorage.setItem("userRole", role);
      toast({
        title: "Account created!",
        description: "Welcome to AtomicTrust Ghost Wallet.",
      });
      // Redirect based on role
      if (role === "admin") {
        navigate("/admin");
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col dark">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-primary">
              <Ghost className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">AtomicTrust</h1>
              <p className="text-xs text-muted-foreground">Ghost Wallet MLM</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl gradient-primary flex items-center justify-center glow-primary">
              <Ghost className="w-12 h-12 text-primary-foreground" />
            </div>
            <h2 className="text-3xl font-bold text-gradient">
              Join the Future of Wealth
            </h2>
            <p className="text-muted-foreground">
              Build your network, earn USDT commissions, and grow your financial freedom.
            </p>
          </div>

          {/* Auth Card */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center">Get Started</CardTitle>
              <CardDescription className="text-center">
                Sign in or create a new account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-role">Login As</Label>
                      <select
                        id="signin-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as "user" | "admin")}
                        className="w-full px-3 py-2 bg-muted/50 border border-input rounded-md text-foreground text-sm"
                      >
                        <option value="user">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full gradient-primary text-primary-foreground font-semibold"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-sponsor">Referral ID (Optional)</Label>
                      <Input
                        id="signup-sponsor"
                        type="text"
                        placeholder="Enter referral ID"
                        value={sponsorId}
                        onChange={(e) => setSponsorId(e.target.value.toUpperCase())}
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        {sponsorId ? `Joining under referral: ${sponsorId}` : 'If someone referred you, enter their referral ID here'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-role">Sign Up As</Label>
                      <select
                        id="signup-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as "user" | "admin")}
                        className="w-full px-3 py-2 bg-muted/50 border border-input rounded-md text-foreground text-sm"
                      >
                        <option value="user">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full gradient-primary text-primary-foreground font-semibold"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-lg bg-muted flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">USDT Payments</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-lg bg-muted flex items-center justify-center">
                <Ghost className="w-5 h-5 text-accent" />
              </div>
              <p className="text-xs text-muted-foreground">Binary System</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-lg bg-muted flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <p className="text-xs text-muted-foreground">Secure & Safe</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
