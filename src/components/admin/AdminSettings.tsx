import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface Settings {
  system_usdt_address: string;
}

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({
    system_usdt_address: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["system_usdt_address"]);

      if (error) throw error;

      const settingsMap: Settings = {
        system_usdt_address: "",
      };

      if (data) {
        (data as unknown as Array<{ key: string; value: string }>).forEach((item) => {
          settingsMap[item.key as keyof Settings] = item.value;
        });
      }

      setSettings(settingsMap);
      console.log("Loaded settings:", settingsMap);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load settings",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.system_usdt_address.trim()) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "System USDT address cannot be empty.",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("settings")
        .upsert(
          [
            {
              key: "system_usdt_address",
              value: settings.system_usdt_address.trim(),
            },
          ],
          { onConflict: "key" }
        );

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings saved successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="usdt_address">System USDT Address (ERC20 - Ethereum)</Label>
          <p className="text-sm text-muted-foreground mb-2">
            This Ethereum address will be displayed to users when they place orders for payment.
          </p>
          <Input
            id="usdt_address"
            type="text"
            placeholder="0x..."
            value={settings.system_usdt_address}
            onChange={(e) =>
              setSettings({
                ...settings,
                system_usdt_address: e.target.value,
              })
            }
            className="font-mono"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="gradient-primary text-primary-foreground w-full"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
