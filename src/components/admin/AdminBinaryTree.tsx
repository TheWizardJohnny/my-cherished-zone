import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RefreshCcw, GitBranch, ChevronUp } from "lucide-react";

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

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          <CardTitle>Binary Tree</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => topRootId && setViewRootId(topRootId)}
            disabled={!topRootId || viewRootId === topRootId}
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            Back to Top
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
          <div className="flex flex-col items-center space-y-12 py-8">
            {Array.from({ length: maxDepth }).map((_, levelIdx) => {
              const levelMap = positionedLevels.get(levelIdx);
              if (!levelMap || levelMap.size === 0) return null;

              const nodesInLevel = Math.pow(2, levelIdx);
              const sortedIndices = Array.from({ length: nodesInLevel }, (_, i) => i).sort((a, b) => a - b);

              return (
                <div key={levelIdx} className="flex flex-col items-center space-y-4 w-full">
                  <div className="text-sm font-semibold text-gray-700">Level {levelIdx + 1}</div>
                  <div className="flex items-center justify-center gap-6 flex-wrap">
                    {sortedIndices.map((idx) => {
                      const node = levelMap.get(idx);
                      const isLeftChild = idx % 2 === 0;

                      if (node) {
                        return <NodeBox key={idx} node={node} onFocus={(id) => setViewRootId(id)} />;
                      } else if (node === null) {
                        return <EmptySlot key={idx} position={isLeftChild ? "left" : "right"} />;
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
