import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Download,
  Share2,
  MessageCircle,
  Mail,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  referral_id: string | null;
  full_name: string | null;
  rank: string;
}

const SOCIAL_TEMPLATES = [
  {
    platform: "Facebook",
    icon: Facebook,
    color: "#1877F2",
    template: "🚀 Excited to share this amazing opportunity with you! Join me on this journey to financial freedom. 💰✨\n\n{referralLink}\n\n#MLM #BusinessOpportunity #FinancialFreedom",
  },
  {
    platform: "Twitter",
    icon: Twitter,
    color: "#1DA1F2",
    template: "🚀 Join me on this incredible journey! Start building your financial future today. 💎\n\n{referralLink}\n\n#MLM #BusinessOpportunity #PassiveIncome",
  },
  {
    platform: "LinkedIn",
    icon: Linkedin,
    color: "#0A66C2",
    template: "I'm excited to share a professional business opportunity that's been transforming lives. If you're interested in building additional income streams, let's connect!\n\n{referralLink}\n\n#BusinessOpportunity #Entrepreneurship #NetworkMarketing",
  },
  {
    platform: "WhatsApp",
    icon: MessageCircle,
    color: "#25D366",
    template: "Hey! 👋\n\nI wanted to share something exciting with you. I've been part of this amazing business opportunity and thought you might be interested too!\n\nCheck it out: {referralLink}\n\nLet me know if you have any questions! 😊",
  },
  {
    platform: "Email",
    icon: Mail,
    color: "#EA4335",
    subject: "Exciting Business Opportunity - Join Me!",
    template: "Hi there!\n\nI hope this email finds you well. I wanted to reach out because I've recently joined an incredible business opportunity that I think you'd be interested in.\n\nThis platform has helped me [your achievement here], and I believe it could do the same for you.\n\nHere's my personal referral link: {referralLink}\n\nFeel free to reach out if you have any questions. I'd be happy to share more details!\n\nBest regards,\n{yourName}",
  },
];

const PROMOTIONAL_IMAGES = [
  {
    id: "banner-1",
    title: "Success Banner",
    description: "Professional banner for social media",
    gradient: "from-blue-500 via-purple-500 to-pink-500",
    text: "Join Our Success Story",
    subtext: "Start Your Journey Today",
  },
  {
    id: "banner-2",
    title: "Growth Banner",
    description: "Motivational growth-focused design",
    gradient: "from-green-400 via-emerald-500 to-teal-600",
    text: "Grow Your Business",
    subtext: "Unlimited Potential Awaits",
  },
  {
    id: "banner-3",
    title: "Freedom Banner",
    description: "Financial freedom theme",
    gradient: "from-orange-400 via-red-500 to-pink-600",
    text: "Financial Freedom",
    subtext: "Build Your Future Now",
  },
  {
    id: "banner-4",
    title: "Community Banner",
    description: "Team and community focused",
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    text: "Join Our Community",
    subtext: "Success Through Teamwork",
  },
];

export function MarketingTools() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customMessage, setCustomMessage] = useState("");
  const [qrSize, setQrSize] = useState<number>(256);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("referral_id, full_name, rank")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } else {
        setProfile(data);
        // Initialize custom message with first template
        if (data?.referral_id) {
          const link = getReferralLink(data.referral_id);
          setCustomMessage(
            SOCIAL_TEMPLATES[0].template
              .replace("{referralLink}", link)
              .replace("{yourName}", data.full_name || "Your Name")
          );
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user, toast]);

  const getReferralLink = (referralId: string) => {
    return `${window.location.origin}/?ref=${referralId}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(label);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = qrSize;
    canvas.height = qrSize;

    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `referral-qr-${profile?.referral_id}.png`;
          link.click();
          URL.revokeObjectURL(url);
          toast({
            title: "Downloaded!",
            description: "QR code saved successfully",
          });
        }
      });
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const downloadBanner = (bannerId: string, title: string) => {
    const banner = document.getElementById(bannerId);
    if (!banner) return;

    // This is a simplified version - in production, you'd use html2canvas or similar
    toast({
      title: "Download Ready",
      description: `Right-click the ${title} and select "Save image as..." to download`,
    });
  };

  const shareToSocial = (platform: string, message: string) => {
    const referralLink = profile?.referral_id ? getReferralLink(profile.referral_id) : "";
    const finalMessage = message
      .replace("{referralLink}", referralLink)
      .replace("{yourName}", profile?.full_name || "Your Name");

    let url = "";
    switch (platform) {
      case "Facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(finalMessage)}`;
        break;
      case "Twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(finalMessage)}`;
        break;
      case "LinkedIn":
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`;
        break;
      case "WhatsApp":
        url = `https://wa.me/?text=${encodeURIComponent(finalMessage)}`;
        break;
      default:
        return;
    }

    window.open(url, "_blank", "width=600,height=400");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile?.referral_id) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No referral ID found. Please contact support.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const referralLink = getReferralLink(profile.referral_id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              <CardTitle className="text-2xl">Marketing Tools</CardTitle>
            </div>
            <CardDescription className="text-white/90">
              Grow your network with professional marketing materials and sharing tools
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="qr-code" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="qr-code">QR Code</TabsTrigger>
            <TabsTrigger value="social-sharing">Social Sharing</TabsTrigger>
            <TabsTrigger value="promotional">Promotional Materials</TabsTrigger>
          </TabsList>

          {/* QR Code Tab */}
          <TabsContent value="qr-code" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your Referral Link</CardTitle>
                  <CardDescription>Share this link to invite new members</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input value={referralLink} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(referralLink, "Referral link")}
                    >
                      {copiedItem === "Referral link" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Your Referral ID</label>
                      <Badge variant="secondary">{profile.referral_id}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Your Rank</label>
                      <Badge>{profile.rank}</Badge>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium">QR Code Size</label>
                    <Select value={String(qrSize)} onValueChange={(v) => setQrSize(Number(v))}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="128">Small (128px)</SelectItem>
                        <SelectItem value="256">Medium (256px)</SelectItem>
                        <SelectItem value="512">Large (512px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>QR Code</CardTitle>
                  <CardDescription>Let others scan to join through your referral</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-lg">
                    <QRCodeSVG
                      id="qr-code-svg"
                      value={referralLink}
                      size={qrSize}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <Button onClick={downloadQRCode} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Download QR Code
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Social Sharing Tab */}
          <TabsContent value="social-sharing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Templates</CardTitle>
                <CardDescription>
                  Pre-written messages optimized for each platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {SOCIAL_TEMPLATES.map((template, index) => {
                    const Icon = template.icon;
                    return (
                      <Button
                        key={template.platform}
                        variant={selectedTemplate === index ? "default" : "outline"}
                        className="gap-2"
                        onClick={() => {
                          setSelectedTemplate(index);
                          setCustomMessage(
                            template.template
                              .replace("{referralLink}", referralLink)
                              .replace("{yourName}", profile.full_name || "Your Name")
                          );
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        {template.platform}
                      </Button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Message Preview & Customize</label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Personalize the message to match your style and add your own achievements!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => copyToClipboard(customMessage, "Message")}
                  >
                    {copiedItem === "Message" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy Message
                  </Button>
                  {selectedTemplate < 4 && (
                    <Button
                      className="gap-2"
                      onClick={() =>
                        shareToSocial(
                          SOCIAL_TEMPLATES[selectedTemplate].platform,
                          customMessage
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                      Share to {SOCIAL_TEMPLATES[selectedTemplate].platform}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Share Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Share</CardTitle>
                <CardDescription>Share instantly to your favorite platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {SOCIAL_TEMPLATES.slice(0, 4).map((template) => {
                    const Icon = template.icon;
                    return (
                      <Button
                        key={template.platform}
                        variant="outline"
                        className="gap-2 h-auto py-4 flex-col"
                        onClick={() => shareToSocial(template.platform, template.template)}
                        style={{ borderColor: template.color, color: template.color }}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{template.platform}</span>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Promotional Materials Tab */}
          <TabsContent value="promotional" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Promotional Banners</CardTitle>
                <CardDescription>
                  Professional graphics for your social media and marketing campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {PROMOTIONAL_IMAGES.map((banner) => (
                    <Card key={banner.id} className="overflow-hidden">
                      <div
                        id={banner.id}
                        className={`h-48 bg-gradient-to-r ${banner.gradient} flex flex-col items-center justify-center text-white relative`}
                      >
                        <div className="text-center space-y-2 px-4">
                          <h3 className="text-3xl font-bold drop-shadow-lg">{banner.text}</h3>
                          <p className="text-lg drop-shadow-md">{banner.subtext}</p>
                          <div className="pt-4">
                            <Badge variant="secondary" className="text-xs font-mono">
                              {referralLink}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <h4 className="font-semibold">{banner.title}</h4>
                          <p className="text-sm text-muted-foreground">{banner.description}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => downloadBanner(banner.id, banner.title)}
                          >
                            <Download className="h-4 w-4" />
                            Download Banner
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Marketing Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Marketing Tips</CardTitle>
                <CardDescription>Best practices for growing your network</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Be Authentic</h4>
                        <p className="text-sm text-muted-foreground">
                          Share your genuine experience and success story
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Target Your Audience</h4>
                        <p className="text-sm text-muted-foreground">
                          Share in relevant groups and communities
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Consistent Posting</h4>
                        <p className="text-sm text-muted-foreground">
                          Regular updates keep your network engaged
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Use Multiple Channels</h4>
                        <p className="text-sm text-muted-foreground">
                          Diversify your marketing across platforms
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
