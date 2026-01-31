"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSetAtom } from "jotai"
import {
  FolderSync,
  RefreshCw,
  Loader2,
  AlertTriangle,
  X,
  Play,
  Pause,
  WrapText,
  Filter,
  Settings,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Terminal,
} from "lucide-react"
import { cn } from "../../../lib/utils"
import { trpc } from "../../../lib/trpc"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select"
import { Checkbox } from "../../../components/ui/checkbox"
import { Input } from "../../../components/ui/input"
import { Button } from "../../../components/ui/button"
import { Label } from "../../../components/ui/label"
import { createTerminalRequestAtom } from "../../terminal/atoms"

interface DevSpaceLogEntry {
  timestamp: string
  level: "info" | "warn" | "error" | "debug"
  message: string
  raw: string
}

interface DevSpaceProcess {
  pid: number
  command: string
  workingDir: string
  startTime: string
  isOurs: boolean
  serviceName?: string
  terminalPaneId?: string
}

/**
 * Get color class based on log level
 */
function getLevelColor(level: DevSpaceLogEntry["level"]): string {
  switch (level) {
    case "error":
      return "text-red-400"
    case "warn":
      return "text-amber-400"
    case "debug":
      return "text-purple-400"
    case "info":
    default:
      return "text-blue-400"
  }
}

/**
 * Get background color for log level badge
 */
function getLevelBadgeClass(level: DevSpaceLogEntry["level"]): string {
  switch (level) {
    case "error":
      return "bg-red-500/20 text-red-400"
    case "warn":
      return "bg-amber-500/20 text-amber-400"
    case "debug":
      return "bg-purple-500/20 text-purple-400"
    case "info":
    default:
      return "bg-blue-500/20 text-blue-400"
  }
}

/**
 * DevSpace Settings Panel
 */
function DevSpaceSettings({
  isOpen,
  onToggle,
}: {
  isOpen: boolean
  onToggle: () => void
}) {
  const utils = trpc.useUtils()
  const { data: settings, isLoading } = trpc.devspace.getSettings.useQuery()
  const updateMutation = trpc.devspace.updateSettings.useMutation({
    onSuccess: () => {
      utils.devspace.getSettings.invalidate()
      utils.devspace.listDevspaceServices.invalidate()
    },
  })

  const [localReposPath, setLocalReposPath] = useState("")
  const [localConfigSubPath, setLocalConfigSubPath] = useState("")
  const [localStartCommand, setLocalStartCommand] = useState("")

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

  const hasChanges = settings && (
    (localReposPath.trim() || null) !== settings.reposPath ||
    localConfigSubPath.trim() !== settings.configSubPath ||
    localStartCommand.trim() !== settings.startCommand
  )

  return (
    <div className="border-b border-border/50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">DevSpace Settings</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings...
            </div>
          ) : (
            <>
              {/* Repos Path */}
              <div className="space-y-2">
                <Label htmlFor="repos-path" className="text-xs text-muted-foreground">
                  Repos Path
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="repos-path"
                    value={localReposPath}
                    onChange={(e) => setLocalReposPath(e.target.value)}
                    placeholder={settings?.effectiveReposPath || "e.g., /Users/you/repos"}
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => {
                      // Could integrate with file picker if needed
                    }}
                  >
                    <FolderOpen className="h-3 w-3" />
                  </Button>
                </div>
                {settings?.effectiveReposPath && !localReposPath && (
                  <p className="text-[10px] text-muted-foreground">
                    Using environment variable: {settings.effectiveReposPath}
                  </p>
                )}
              </div>

              {/* Config Sub Path */}
              <div className="space-y-2">
                <Label htmlFor="config-sub-path" className="text-xs text-muted-foreground">
                  Config File Path
                </Label>
                <Input
                  id="config-sub-path"
                  value={localConfigSubPath}
                  onChange={(e) => setLocalConfigSubPath(e.target.value)}
                  placeholder="devspace.yaml"
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Path relative to service root (e.g., "devspace.yaml" or "deploy/devspace.yaml")
                </p>
              </div>

              {/* Start Command */}
              <div className="space-y-2">
                <Label htmlFor="start-command" className="text-xs text-muted-foreground">
                  Start Command
                </Label>
                <Input
                  id="start-command"
                  value={localStartCommand}
                  onChange={(e) => setLocalStartCommand(e.target.value)}
                  placeholder="devspace dev"
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Command to run when starting a service (e.g., "devspace dev", "dy dev")
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || updateMutation.isPending}
                  className="h-7 text-xs"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function DevSpaceTab() {
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [logs, setLogs] = useState<DevSpaceLogEntry[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [wrapText, setWrapText] = useState(true)
  const [filterText, setFilterText] = useState("")
  const [filterLevel, setFilterLevel] = useState<DevSpaceLogEntry["level"] | "all">("all")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Service selection state
  const [selectedService, setSelectedService] = useState<string>("")
  const setCreateTerminalRequest = useSetAtom(createTerminalRequestAtom)

  // Check if devspace is available
  const { data: isAvailable } = trpc.devspace.isAvailable.useQuery()

  // Get devspace settings
  const { data: settings } = trpc.devspace.getSettings.useQuery()

  // Get list of available services
  const {
    data: devspaceServices,
    isLoading: servicesLoading,
    refetch: refetchServices,
    isRefetching: isRefetchingServices,
  } = trpc.devspace.listDevspaceServices.useQuery()

  // Get devspace version
  const { data: version } = trpc.devspace.getVersion.useQuery(undefined, {
    enabled: isAvailable === true,
  })

  // Get list of our started processes (processes we started)
  const {
    data: ourProcesses,
    isLoading: processesLoading,
    refetch: refetchProcesses,
    isRefetching,
  } = trpc.devspace.listOurProcesses.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  // Stream logs using tRPC subscription
  trpc.devspace.streamLogs.useSubscription(
    { pid: selectedProcess! },
    {
      enabled: isStreaming && selectedProcess !== null,
      onData: (log) => {
        setStreamError(null)
        setLogs((prev) => {
          const updated = [...prev, log]
          // Keep only last 1000 logs
          return updated.slice(-1000)
        })
      },
      onError: (error) => {
        console.error("[DevSpaceTab] Stream error:", error)
        setStreamError(error.message || "Failed to stream logs")
        setIsStreaming(false)
      },
    }
  )

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, autoScroll])

  // Clear selection if selected process is no longer available
  useEffect(() => {
    if (selectedProcess && ourProcesses) {
      const stillExists = ourProcesses.some((p) => p.pid === selectedProcess)
      if (!stillExists) {
        setSelectedProcess(null)
        setIsStreaming(false)
        setLogs([])
      }
    }
  }, [ourProcesses, selectedProcess])

  const handleProcessSelect = (pidStr: string) => {
    const pid = parseInt(pidStr, 10)
    if (!isNaN(pid)) {
      setSelectedProcess(pid)
      setLogs([])
      setStreamError(null)
      setIsStreaming(false)
    }
  }

  const handleStartStreaming = () => {
    if (!selectedProcess) return
    setLogs([])
    setStreamError(null)
    setIsStreaming(true)
  }

  const handleStopStreaming = () => {
    setIsStreaming(false)
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  // Handle starting a devspace service
  const handleStartDevspace = () => {
    if (!selectedService) return

    const service = devspaceServices?.find((s) => s.name === selectedService)
    if (!service) return

    // Get the start command from settings
    const startCommand = settings?.startCommand || "devspace dev"

    // Create a new terminal with the service's path and run the start command
    setCreateTerminalRequest({
      name: `devspace: ${service.name}`,
      cwd: service.path,
      initialCommands: [startCommand],
    })
  }

  // Filter logs based on text and level
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (filterLevel !== "all" && log.level !== filterLevel) {
        return false
      }
      // Text filter (case-insensitive)
      if (filterText && !log.message.toLowerCase().includes(filterText.toLowerCase())) {
        return false
      }
      return true
    })
  }, [logs, filterText, filterLevel])

  // Get selected process info
  const selectedProcessInfo = useMemo(() => {
    if (!selectedProcess || !ourProcesses) return null
    return ourProcesses.find((p) => p.pid === selectedProcess)
  }, [selectedProcess, ourProcesses])

  // Check if repos path is configured
  const hasReposPath = settings?.effectiveReposPath

  if (isAvailable === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <div className="p-4 rounded-full bg-muted/50">
          <FolderSync className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">DevSpace Not Found</h3>
          <p className="text-sm mt-1">
            DevSpace CLI is not installed or not in your PATH.
          </p>
          <a
            href="https://devspace.sh/docs/getting-started/installation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            Install DevSpace
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Settings Panel */}
      <DevSpaceSettings
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />

      {/* Unified Control Bar */}
      <div className="p-4 border-b border-border space-y-4 flex-shrink-0">
        {/* Start Devspace + Running Processes Row */}
        <div className="flex items-center gap-4">
          {/* Service Selector */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium whitespace-nowrap">Start Devspace:</span>
            <Select
              value={selectedService}
              onValueChange={setSelectedService}
            >
              <SelectTrigger className="w-full max-w-sm h-8 text-xs">
                <SelectValue placeholder={hasReposPath ? "Select a service" : "Configure repos path in settings"} />
              </SelectTrigger>
              <SelectContent>
                {servicesLoading ? (
                  <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading services...
                  </div>
                ) : !hasReposPath ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Configure repos path in settings above
                  </div>
                ) : devspaceServices && devspaceServices.length > 0 ? (
                  devspaceServices.map((service) => (
                    <SelectItem key={service.name} value={service.name}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{service.name}</span>
                        {service.hasDevConfig && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                            config found
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    No services found in repos path
                  </div>
                )}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => refetchServices()}
              disabled={isRefetchingServices}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title="Refresh services"
            >
              <RefreshCw className={cn("h-4 w-4", isRefetchingServices && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={handleStartDevspace}
              disabled={!selectedService || !hasReposPath}
              className={cn(
                "px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-md flex items-center gap-1",
                (!selectedService || !hasReposPath) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Play className="h-3 w-3" />
              Start
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border/50" />

          {/* Running Processes Selector */}
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">Running:</span>
            <Select
              value={selectedProcess?.toString() || ""}
              onValueChange={handleProcessSelect}
              disabled={isStreaming}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Select process" />
              </SelectTrigger>
              <SelectContent>
                {processesLoading ? (
                  <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </div>
                ) : ourProcesses && ourProcesses.length > 0 ? (
                  ourProcesses.map((proc) => (
                    <SelectItem key={proc.pid} value={proc.pid.toString()}>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">
                          {proc.serviceName || `PID ${proc.pid}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          PID {proc.pid}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    No running processes
                  </div>
                )}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => refetchProcesses()}
              disabled={isRefetching}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title="Refresh processes"
            >
              <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
            </button>
          </div>

          {/* Version info */}
          {version && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">v{version.split('\n')[0]}</span>
          )}
        </div>

        {/* Selected Process Info */}
        {selectedProcessInfo && (
          <div className="px-3 py-2 bg-muted/30 rounded-md text-xs">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Working Dir: <span className="text-foreground font-mono">{selectedProcessInfo.workingDir}</span>
              </span>
              <span className="text-muted-foreground">
                Started: <span className="text-foreground">{selectedProcessInfo.startTime}</span>
              </span>
              {selectedProcessInfo.terminalPaneId && (
                <span className="text-muted-foreground">
                  Terminal: <span className="text-foreground font-mono">{selectedProcessInfo.terminalPaneId}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Filters and Controls - Only show when process is selected */}
        {selectedProcess && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Text Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter logs..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="h-8 w-48 text-xs"
                />
              </div>

              {/* Level Filter */}
              <Select
                value={filterLevel}
                onValueChange={(value) => setFilterLevel(value as DevSpaceLogEntry["level"] | "all")}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>

              {/* Wrap Toggle */}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={wrapText}
                  onCheckedChange={(checked) => setWrapText(checked === true)}
                />
                <WrapText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">Wrap</span>
              </label>

              {/* Auto-scroll Toggle */}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={autoScroll}
                  onCheckedChange={(checked) => setAutoScroll(checked === true)}
                />
                <span className="text-muted-foreground text-xs">Auto-scroll</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-md flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
              {!isStreaming ? (
                <button
                  type="button"
                  onClick={handleStartStreaming}
                  disabled={!selectedProcess}
                  className={cn(
                    "px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-md flex items-center gap-1",
                    !selectedProcess && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Play className="h-3 w-3" />
                  Stream Logs
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  className="px-3 py-1.5 text-xs bg-red-500 text-white hover:bg-red-600 rounded-md flex items-center gap-1"
                >
                  <Pause className="h-3 w-3" />
                  Stop
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Log Display */}
      <div className="flex-1 overflow-y-auto bg-muted/30 p-4">
        {streamError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="p-4 rounded-full bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <div className="text-center max-w-2xl">
              <h3 className="text-lg font-medium text-foreground mb-2">Log Streaming Error</h3>
              <p className="text-sm text-muted-foreground mb-4">{streamError}</p>
              <button
                type="button"
                onClick={() => {
                  setStreamError(null)
                  handleStartStreaming()
                }}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <div className="p-4 rounded-full bg-muted/50">
              <FolderSync className="h-8 w-8" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground">DevSpace Logs</h3>
              {!selectedProcess ? (
                <p className="text-sm mt-1">
                  {ourProcesses && ourProcesses.length > 0
                    ? "Select a running process to view logs"
                    : "Start a service above to see its logs here"}
                </p>
              ) : logs.length === 0 ? (
                <p className="text-sm mt-1">Click "Stream Logs" to begin</p>
              ) : (
                <p className="text-sm mt-1">No logs match the current filter</p>
              )}
            </div>
          </div>
        ) : (
          <div className="font-mono text-xs space-y-1">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-2 hover:bg-muted/50 px-2 py-1 rounded",
                  !wrapText && "whitespace-nowrap"
                )}
              >
                <span className="text-muted-foreground flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold flex-shrink-0",
                    getLevelBadgeClass(log.level)
                  )}
                >
                  {log.level}
                </span>
                <span
                  className={cn(
                    "text-foreground",
                    wrapText ? "break-all" : "overflow-hidden text-ellipsis",
                    getLevelColor(log.level)
                  )}
                >
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Status Bar */}
      {isStreaming && (
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-muted-foreground">
              Streaming logs from {selectedProcessInfo?.serviceName || `PID ${selectedProcess}`}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {filterText && (
              <span className="text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} entries
              </span>
            )}
            <span className="text-muted-foreground">{logs.length} total log entries</span>
          </div>
        </div>
      )}
    </div>
  )
}
