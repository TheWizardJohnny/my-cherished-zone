import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RefreshCcw, GitBranch, ChevronUp, ZoomIn, ZoomOut, Search, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Profile = Tables<"profiles">;
type Placement = Tables<"placements">;

interface TreeNode {
  id: string;
  profile: Profile | undefined;
  placement: Placement | undefined;
  children: TreeNode[];
}

interface PositionedNode {
  node: TreeNode;
  index: number; // heap-style index to preserve left/right spacing
  level: number;
}

function buildTree(placements: Placement[], profilesById: Record<string, Profile>, rootId: string): TreeNode | null {
  const map: Record<string, TreeNode> = {};
  placements.forEach((p) => {
    map[p.user_id] = {
      id: p.user_id,
      profile: profilesById[p.user_id],
      placement: p,
      children: [],
    };
  });

  // Attach children
  placements.forEach((p) => {
    if (p.upline_id && map[p.upline_id] && map[p.user_id]) {
      map[p.upline_id].children.push(map[p.user_id]);
    }
  });

  // Keep left/right ordering predictable
  Object.values(map).forEach((node) => {
    node.children.sort((a, b) => {
      const posA = a.placement?.position || "";
      const posB = b.placement?.position || "";
      if (posA === posB) return (a.profile?.email || "").localeCompare(b.profile?.email || "");
      if (posA === "left") return -1;
      if (posB === "left") return 1;
      return posA.localeCompare(posB);
    });
  });

  return map[rootId] ?? null;
}

function buildPositionedLevels(root: TreeNode | null, maxDepth: number): Map<number, Map<number, TreeNode | null>> {
  // Returns a map of level -> map of position index -> node (or null for open slots)
  const tree = new Map<number, Map<number, TreeNode | null>>();
  
  if (!root) return tree;

  const queue: PositionedNode[] = [{ node: root, index: 0, level: 0 }];

  while (queue.length) {
    const current = queue.shift()!;
    if (current.level >= maxDepth) continue;
    
    if (!tree.has(current.level)) tree.set(current.level, new Map());
    tree.get(current.level)!.set(current.index, current.node);

    const left = current.node.children.find((c) => c.placement?.position === "left");
    const right = current.node.children.find((c) => c.placement?.position === "right");

    if (current.level + 1 < maxDepth) {
      const nextLevel = current.level + 1;
      if (!tree.has(nextLevel)) tree.set(nextLevel, new Map());
      
      const leftIndex = current.index * 2;
      const rightIndex = current.index * 2 + 1;
      
      if (left) {
        queue.push({ node: left, index: leftIndex, level: nextLevel });
      } else {
        tree.get(nextLevel)!.set(leftIndex, null);
      }
      
      if (right) {
        queue.push({ node: right, index: rightIndex, level: nextLevel });
      } else {
        tree.get(nextLevel)!.set(rightIndex, null);
      }
    }
  }

  return tree;
}

function NodeBox({ node, onFocus }: { node: TreeNode; onFocus: (id: string) => void }) {
  const profile = node.profile;
  const left = node.children.find((c) => c.placement?.position === "left");
  const right = node.children.find((c) => c.placement?.position === "right");
  return (
    <button
      onClick={() => onFocus(node.id)}
      className="w-full min-w-[180px] max-w-[220px] text-left rounded border-2 border-black bg-white shadow-sm hover:shadow-md transition-shadow px-3 py-2"
    >
      <div className="font-semibold truncate text-sm">{profile?.email || "Unassigned"}</div>
      <div className="text-xs text-gray-600 truncate">{profile?.referral_id || "—"}</div>
      <div className="text-xs text-gray-600 capitalize">{profile?.status || "active"}</div>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        <span className={`px-2 py-0.5 rounded ${left ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
          Left: {left ? "filled" : "open"}
        </span>
        <span className={`px-2 py-0.5 rounded ${right ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
          Right: {right ? "filled" : "open"}
        </span>
      </div>
    </button>
  );
}

function EmptySlot({ position }: { position: "left" | "right" }) {
  return (
    <div className="w-full min-w-[180px] max-w-[220px] rounded border-2 border-dashed border-gray-400 bg-gray-50 px-3 py-2 text-center">
      <div className="text-sm text-gray-500 font-medium capitalize">{position} Position</div>
      <div className="text-xs text-gray-400 mt-1">Available</div>
    </div>
  );
}

export function AdminBinaryTree() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewRootId, setViewRootId] = useState<string | null>(null);
  const [topRootId, setTopRootId] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState(3);
  const [zoom, setZoom] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  // Pan and drag state (must be at top level)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: placementsData, error: placementsError }, { data: profilesData, error: profilesError }] = await Promise.all([
        supabase.from("placements").select("user_id, upline_id, position, status, created_at"),
        supabase.from("profiles").select("id, email, referral_id, status, created_at"),
      ]);

      if (placementsError) throw placementsError;
      if (profilesError) throw profilesError;

      const profilesById: Record<string, Profile> = {};
      (profilesData || []).forEach((p) => {
        profilesById[p.id] = p as Profile;
      });

      setPlacements(placementsData || []);
      setProfiles(profilesById);

      const preferredRoot = (profilesData || []).find(
        (p) => p.email && p.email.toLowerCase() === "atomictrust@protonmail.com"
      );

      const rootPlacement = (placementsData || []).find((p) => !p.upline_id) || (placementsData || [])[0];
      const rootId = preferredRoot?.id || rootPlacement?.user_id || null;
      setTopRootId(rootId);
      setViewRootId((prev) => prev ?? rootId);
    } catch (err: any) {
      console.error("Error loading binary tree:", err);
      setError("Could not load binary tree.");
    } finally {
      setLoading(false);
    }
  };

  const rootNode = useMemo(() => {
    if (!viewRootId) return null;
    return buildTree(placements, profiles, viewRootId);
  }, [placements, profiles, viewRootId]);

  const positionedLevels = useMemo(() => buildPositionedLevels(rootNode, maxDepth), [rootNode, maxDepth]);

  const currentUplineId = useMemo(() => {
    if (!viewRootId) return null;
    const currentPlacement = placements.find(p => p.user_id === viewRootId);
    return currentPlacement?.upline_id || null;
  }, [viewRootId, placements]);

  const handleGoToUpline = () => {
    if (currentUplineId) {
      const uplineProfile = profiles[currentUplineId];
      setViewRootId(currentUplineId);
      toast({
        title: "Navigated to upline",
        description: `Now viewing: ${uplineProfile?.email || uplineProfile?.referral_id || "Upline user"}`,
      });
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter an email address or referral ID to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    const query = searchQuery.trim().toLowerCase();
    
    // Search in profiles by email or referral_id
    const foundProfile = Object.values(profiles).find(
      (p) =>
        p.email?.toLowerCase().includes(query) ||
        p.referral_id?.toLowerCase() === query
    );

    if (foundProfile) {
      // Check if this user has a placement
      const hasPlacement = placements.some(p => p.user_id === foundProfile.id);
      
      if (hasPlacement) {
        setViewRootId(foundProfile.id);
        toast({
          title: "User found!",
          description: `Now viewing tree from: ${foundProfile.email || foundProfile.referral_id}`,
        });
      } else {
        toast({
          title: "User found but not placed",
          description: `${foundProfile.email} exists but has no placement in the binary tree yet.`,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "User not found",
        description: `No user found with email or referral ID matching "${searchQuery}".`,
        variant: "destructive",
      });
    }
    
    setIsSearching(false);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    if (topRootId) {
      setViewRootId(topRootId);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <CardTitle>Binary Tree</CardTitle>
          </div>
          {/* Navigation Buttons - Right Side */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToUpline}
              disabled={!currentUplineId}
              title={currentUplineId ? "View direct upline" : "No upline (at top of tree)"}
              className="w-full"
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Go to Upline
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => topRootId && setViewRootId(topRootId)}
              disabled={!topRootId || viewRootId === topRootId}
              className="w-full"
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Back to Top
            </Button>
          </div>
        </div>
        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by email or referral ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-8 pr-8 w-64"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
            >
              <Search className="h-4 w-4 mr-1" />
              Find
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Depth</span>
            <div className="w-40">
              <Slider
                value={[maxDepth]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => setMaxDepth(v[0])}
              />
            </div>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-16"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Zoom</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setZoom((z) => Math.max(25, z - 10))}
              disabled={zoom <= 25}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[50px] text-center">{zoom}%</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {error && <div className="text-sm text-red-500 mb-4">{error}</div>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading binary tree…</div>
        ) : !rootNode ? (
          <div className="text-sm text-muted-foreground">No placements found.</div>
        ) : (
          <div className="flex justify-center w-full">
            <div 
              className="space-y-16 py-8 px-4 transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
            {Array.from({ length: maxDepth }).map((_, levelIdx) => {
              const levelMap = positionedLevels.get(levelIdx);
              if (!levelMap || levelMap.size === 0) return null;

              const nodesInLevel = Math.pow(2, levelIdx);
              const sortedIndices = Array.from({ length: nodesInLevel }, (_, i) => i).sort((a, b) => a - b);

              // Level 1 always centered with flex
              if (levelIdx === 0) {
                const node = levelMap.get(0);
                return (
                  <div key={levelIdx} className="relative">
                    <div className="text-sm font-semibold text-gray-700 text-center mb-6">Level 1</div>
                    <div className="flex justify-center">
                      {node && <NodeBox node={node} onFocus={(id) => setViewRootId(id)} />}
                    </div>
                  </div>
                );
              }

              // Level 2 always centered with flex
              if (levelIdx === 1) {
                return (
                  <div key={levelIdx} className="relative">
                    <div className="text-sm font-semibold text-gray-700 text-center mb-6">Level 2</div>
                    <div className="flex justify-center gap-6">
                      {sortedIndices.map((idx) => {
                        const node = levelMap.get(idx);
                        const isLeftChild = idx % 2 === 0;
                        if (node) {
                          return <NodeBox key={idx} node={node} onFocus={(id) => setViewRootId(id)} />;
                        } else {
                          return <EmptySlot key={idx} position={isLeftChild ? "left" : "right"} />;
                        }
                      })}
                    </div>
                  </div>
                );
              }

              // Calculate spacing for this level to create pyramid effect
              const totalWidth = Math.pow(2, maxDepth - 1);
              const spacing = totalWidth / nodesInLevel;

              return (
                <div key={levelIdx} className="relative">
                  <div className="text-sm font-semibold text-gray-700 text-center mb-6">Level {levelIdx + 1}</div>
                  <div 
                    className="relative"
                    style={{ 
                      display: 'grid',
                      gridTemplateColumns: `repeat(${totalWidth}, 1fr)`,
                      gap: '1rem',
                      justifyItems: 'center'
                    }}
                  >
                    {sortedIndices.map((idx) => {
                      const node = levelMap.get(idx);
                      const isLeftChild = idx % 2 === 0;
                      const gridColumn = Math.floor(idx * spacing + spacing / 2) + 1;
                      const gridSpan = Math.max(1, Math.floor(spacing));

                      if (node) {
                        return (
                          <div 
                            key={idx} 
                            style={{ 
                              gridColumn: `${gridColumn} / span ${gridSpan}`,
                            }}
                          >
                            <NodeBox node={node} onFocus={(id) => setViewRootId(id)} />
                          </div>
                        );
                      } else {
                        return (
                          <div 
                            key={idx}
                            style={{ 
                              gridColumn: `${gridColumn} / span ${gridSpan}`,
                            }}
                          >
                            <EmptySlot position={isLeftChild ? "left" : "right"} />
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
