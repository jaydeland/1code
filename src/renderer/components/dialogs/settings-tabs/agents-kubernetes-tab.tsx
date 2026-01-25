import { useAtom } from "jotai"
import { useState, useEffect } from "react"
import {
  clustersFeatureEnabledAtom,
  clustersDefaultNamespaceAtom,
} from "../../../lib/atoms"
import { trpc } from "../../../lib/trpc"
import { Switch } from "../../ui/switch"
import { Input } from "../../ui/input"
import { Server } from "lucide-react"

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768)
    }

    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  return isNarrow
}

export function AgentsKubernetesTab() {
  const isNarrowScreen = useIsNarrowScreen()

  // Clusters feature state
  const [clustersEnabled, setClustersEnabled] = useAtom(clustersFeatureEnabledAtom)
  const [defaultNamespace, setDefaultNamespace] = useAtom(clustersDefaultNamespaceAtom)

  // Get derived namespace from email env vars or git config
  const { data: derivedNamespace } = trpc.clusters.getDefaultNamespace.useQuery(undefined, {
    enabled: clustersEnabled,
  })

  // Check if AWS credentials are available
  const { data: clustersAvailability } = trpc.clusters.isAvailable.useQuery(undefined, {
    enabled: clustersEnabled,
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header - hidden on narrow screens since it's in the navigation bar */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">Kubernetes Clusters</h3>
          <p className="text-xs text-muted-foreground">
            Browse and manage EKS clusters using AWS credentials.
          </p>
        </div>
      )}

      {/* Enable Kubernetes Feature */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Server className="h-4 w-4" />
                Enable Kubernetes Clusters
              </span>
              <span className="text-xs text-muted-foreground">
                Browse EKS clusters using AWS credentials. Requires AWS authentication.
              </span>
            </div>
            <Switch
              checked={clustersEnabled}
              onCheckedChange={setClustersEnabled}
            />
          </div>
        </div>
      </div>

      {/* Kubernetes Clusters Settings - only show when feature is enabled */}
      {clustersEnabled && (
        <div className="space-y-4">
          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <div className="p-4 space-y-4">
              {/* AWS Status */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">
                    AWS Credentials
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {clustersAvailability?.available
                      ? clustersAvailability.credentialsExpired
                        ? "Credentials are expired. Re-authenticate in Settings > Authentication."
                        : "Ready to discover EKS clusters"
                      : "Not configured. Set up AWS SSO in Settings > Authentication."}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {clustersAvailability?.available && !clustersAvailability.credentialsExpired ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-sm text-emerald-500">Connected</span>
                    </>
                  ) : clustersAvailability?.credentialsExpired ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-sm text-amber-500">Expired</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground">Not configured</span>
                    </>
                  )}
                </div>
              </div>

              {/* Default Namespace */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">
                      Default Namespace
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Namespace to use when viewing pods and resources.
                      {derivedNamespace && !defaultNamespace && (
                        <> Auto-derived: <code className="bg-muted px-1 rounded">{derivedNamespace}</code></>
                      )}
                    </p>
                  </div>
                </div>
                <Input
                  placeholder={derivedNamespace || "Enter namespace (e.g., default)"}
                  value={defaultNamespace || ""}
                  onChange={(e) => setDefaultNamespace(e.target.value || null)}
                  className="max-w-xs"
                />
                {derivedNamespace && (
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the auto-derived value from your email.
                  </p>
                )}
              </div>

              {/* Info */}
              <div className="text-xs text-muted-foreground bg-muted p-3 rounded space-y-2">
                <p className="font-medium">How it works:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Clusters are auto-discovered from your AWS account</li>
                  <li>Uses the same AWS credentials as Claude Code (Bedrock)</li>
                  <li>Default namespace is derived from your email (e.g., john.doe@example.com → johndoe)</li>
                  <li>Click "Clusters" in the sidebar to browse</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
