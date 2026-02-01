import { useAtom } from "jotai"
import { useState, useEffect, useMemo } from "react"
import {
  clustersFeatureEnabledAtom,
  clustersDefaultNamespaceAtom,
  devspaceFeatureEnabledAtom,
} from "../../../lib/atoms"
import { trpc } from "../../../lib/trpc"
import { Switch } from "../../ui/switch"
import { Input } from "../../ui/input"
import { Button } from "../../ui/button"
import { Label } from "../../ui/label"
import { Server, Loader2, FolderOpen, Settings, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

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

// DevSpace Settings Component
function DevSpaceSettings({ autoExpand = false }: { autoExpand?: boolean }) {
  const utils = trpc.useUtils()
  const { data: settings, isLoading } = trpc.devspace.getSettings.useQuery()
  const updateMutation = trpc.devspace.updateSettings.useMutation({
    onSuccess: () => {
      utils.devspace.getSettings.invalidate()
      utils.devspace.listDevspaceServices.invalidate()
      toast.success("DevSpace settings saved")
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`)
    },
  })

  const [localReposPath, setLocalReposPath] = useState("")
  const [localConfigSubPath, setLocalConfigSubPath] = useState("")
  const [localStartCommand, setLocalStartCommand] = useState("")
  const [isExpanded, setIsExpanded] = useState(autoExpand)

  // Sync local state with server data
  useEffect(() => {
    if (settings) {
      setLocalReposPath(settings.reposPath || "")
      setLocalConfigSubPath(settings.configSubPath)
      setLocalStartCommand(settings.startCommand)
    }
  }, [settings])

  const handleSave = () => {
    updateMutation.mutate({
      reposPath: localReposPath.trim() || null,
      configSubPath: localConfigSubPath.trim() || "devspace.yaml",
      startCommand: localStartCommand.trim() || "devspace dev",
    })
  }

  // Check if there are unsaved changes or if settings haven't loaded yet
  const hasChanges = useMemo(() => {
    // If still loading, can't save
    if (isLoading) return false

    // If settings exist, check for changes from server state
    if (settings) {
      return (
        (localReposPath.trim() || null) !== settings.reposPath ||
        localConfigSubPath.trim() !== settings.configSubPath ||
        localStartCommand.trim() !== settings.startCommand
      )
    }

    // If settings don't exist yet (first time), enable save if any field has a value
    return !!(localReposPath.trim() || localConfigSubPath.trim() || localStartCommand.trim())
  }, [settings, localReposPath, localConfigSubPath, localStartCommand, isLoading])

  const handleSelectFolder = async () => {
    if (typeof window !== "undefined" && window.desktopApi?.showOpenDialog) {
      const result = await window.desktopApi.showOpenDialog({
        title: "Select repos directory",
        properties: ["openDirectory"],
      })

      if (result && result.length > 0) {
        setLocalReposPath(result[0])
      }
    }
  }

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">DevSpace Configuration</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings...
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {/* Repos Path */}
              <div className="space-y-2">
                <Label htmlFor="devspace-repos-path" className="text-xs font-medium">
                  Repos Path
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="devspace-repos-path"
                    value={localReposPath}
                    onChange={(e) => setLocalReposPath(e.target.value)}
                    placeholder={settings?.effectiveReposPath || "e.g., /Users/you/repos"}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={handleSelectFolder}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                {settings?.effectiveReposPath && !localReposPath && (
                  <p className="text-xs text-muted-foreground">
                    Using environment variable: {settings.effectiveReposPath}
                  </p>
                )}
              </div>

              {/* Config Sub Path */}
              <div className="space-y-2">
                <Label htmlFor="devspace-config-path" className="text-xs font-medium">
                  Config File Path
                </Label>
                <Input
                  id="devspace-config-path"
                  value={localConfigSubPath}
                  onChange={(e) => setLocalConfigSubPath(e.target.value)}
                  placeholder="devspace.yaml"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Path relative to service root (e.g., "devspace.yaml" or "deploy/devspace.yaml")
                </p>
              </div>

              {/* Start Command */}
              <div className="space-y-2">
                <Label htmlFor="devspace-start-command" className="text-xs font-medium">
                  Start Command
                </Label>
                <Input
                  id="devspace-start-command"
                  value={localStartCommand}
                  onChange={(e) => setLocalStartCommand(e.target.value)}
                  placeholder="devspace dev"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Command to run when starting a service (e.g., "devspace dev", "dy dev")
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AgentsKubernetesTab() {
  const isNarrowScreen = useIsNarrowScreen()

  // Clusters feature state
  const [clustersEnabled, setClustersEnabled] = useAtom(clustersFeatureEnabledAtom)
  const [defaultNamespace, setDefaultNamespace] = useAtom(clustersDefaultNamespaceAtom)

  // DevSpace feature state
  const [devspaceEnabled, setDevspaceEnabled] = useAtom(devspaceFeatureEnabledAtom)
  const [devspaceJustEnabled, setDevspaceJustEnabled] = useState(false)

  // Track when devspace is toggled on to auto-expand settings
  useEffect(() => {
    if (devspaceEnabled) {
      setDevspaceJustEnabled(true)
      // Reset after render so it doesn't stay true
      const timer = setTimeout(() => setDevspaceJustEnabled(false), 100)
      return () => clearTimeout(timer)
    }
  }, [devspaceEnabled])

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

      {/* Enable DevSpace Feature */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Enable DevSpace
              </span>
              <span className="text-xs text-muted-foreground">
                Local development environment management for microservices. Start and monitor DevSpace services.
              </span>
            </div>
            <Switch
              checked={devspaceEnabled}
              onCheckedChange={setDevspaceEnabled}
            />
          </div>
        </div>
      </div>

      {/* DevSpace Settings - only show when feature is enabled */}
      {devspaceEnabled && (
        <div className="space-y-4">
          <DevSpaceSettings autoExpand={devspaceJustEnabled} />
        </div>
      )}
    </div>
  )
}
