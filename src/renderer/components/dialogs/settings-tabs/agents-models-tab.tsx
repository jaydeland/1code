import { useAtom, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  agentsSettingsDialogOpenAtom,
  anthropicOnboardingCompletedAtom,
  customClaudeConfigAtom,
  type CustomClaudeConfig,
} from "../../../lib/atoms"
import { trpc } from "../../../lib/trpc"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"

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

const EMPTY_CONFIG: CustomClaudeConfig = {
  model: "",
  token: "",
  baseUrl: "",
}

export function AgentsModelsTab() {
  const [storedConfig, setStoredConfig] = useAtom(customClaudeConfigAtom)
  const [model, setModel] = useState(storedConfig.model)
  const [baseUrl, setBaseUrl] = useState(storedConfig.baseUrl)
  const [token, setToken] = useState(storedConfig.token)
  const setAnthropicOnboardingCompleted = useSetAtom(
    anthropicOnboardingCompletedAtom,
  )
  const setSettingsOpen = useSetAtom(agentsSettingsDialogOpenAtom)
  const isNarrowScreen = useIsNarrowScreen()
  const disconnectClaudeCode = trpc.claudeCode.disconnect.useMutation()
  const { data: claudeCodeIntegration, isLoading: isClaudeCodeLoading } =
    trpc.claudeCode.getIntegration.useQuery()
  const isClaudeCodeConnected = claudeCodeIntegration?.isConnected

  // Get SDK version info
  const { data: versionInfo } = trpc.claude.getVersionInfo.useQuery()

  // Bedrock model settings
  const { data: claudeSettings, refetch: refetchSettings } = trpc.claudeSettings.getSettings.useQuery()
  const updateSettings = trpc.claudeSettings.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Bedrock settings saved")
      refetchSettings()
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save settings")
    },
  })

  const [bedrockOpusModel, setBedrockOpusModel] = useState("")
  const [bedrockSonnetModel, setBedrockSonnetModel] = useState("")
  const [bedrockHaikuModel, setBedrockHaikuModel] = useState("")
  const [maxMcpOutputTokens, setMaxMcpOutputTokens] = useState("")
  const [maxThinkingTokens, setMaxThinkingTokens] = useState("")

  // Sync from settings
  useEffect(() => {
    if (claudeSettings) {
      setBedrockOpusModel(claudeSettings.bedrockOpusModel || "")
      setBedrockSonnetModel(claudeSettings.bedrockSonnetModel || "")
      setBedrockHaikuModel(claudeSettings.bedrockHaikuModel || "")
      setMaxMcpOutputTokens(String(claudeSettings.maxMcpOutputTokens || ""))
      setMaxThinkingTokens(String(claudeSettings.maxThinkingTokens || ""))
    }
  }, [claudeSettings])

  useEffect(() => {
    setModel(storedConfig.model)
    setBaseUrl(storedConfig.baseUrl)
    setToken(storedConfig.token)
  }, [storedConfig.model, storedConfig.baseUrl, storedConfig.token])

  const trimmedModel = model.trim()
  const trimmedBaseUrl = baseUrl.trim()
  const trimmedToken = token.trim()
  const canSave = Boolean(trimmedModel && trimmedBaseUrl && trimmedToken)
  const canReset = Boolean(trimmedModel || trimmedBaseUrl || trimmedToken)

  const handleSave = () => {
    if (!canSave) {
      toast.error("Fill model, token, and base URL to save")
      return
    }
    const nextConfig: CustomClaudeConfig = {
      model: trimmedModel,
      token: trimmedToken,
      baseUrl: trimmedBaseUrl,
    }

    setStoredConfig(nextConfig)
    toast.success("Model settings saved")
  }

  const handleReset = () => {
    setStoredConfig(EMPTY_CONFIG)
    setModel("")
    setBaseUrl("")
    setToken("")
    toast.success("Model settings reset")
  }

  const handleClaudeCodeSetup = () => {
    if (isClaudeCodeConnected) {
      // Already connected - disconnect
      disconnectClaudeCode.mutate()
      setAnthropicOnboardingCompleted(false)
    } else {
      // Not connected - trigger OAuth flow
      setSettingsOpen(false)
      setAnthropicOnboardingCompleted(false)
    }
  }

  // Determine current model being used
  const currentModel = storedConfig.model || "claude-sonnet-4-5-20250929"

  return (
    <div className="p-6 space-y-6">
      {/* Header - hidden on narrow screens since it's in the navigation bar */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">Models</h3>
          <p className="text-xs text-muted-foreground">
            Configure model overrides and Claude Code authentication
          </p>
        </div>
      )}

      {/* SDK Version and Models */}
      <div className="space-y-2">
        <div className="pb-2">
          <h4 className="text-sm font-medium text-foreground">Version Information</h4>
        </div>

        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="p-4 space-y-4">
            {/* SDK Version */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Claude Agent SDK</span>
              <span className="text-sm font-mono text-foreground">
                {versionInfo?.sdkVersion || "Loading..."}
              </span>
            </div>

            {/* Binary Version */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Claude Binary</span>
              <span className="text-sm font-mono text-foreground">
                {versionInfo?.binaryVersion || "Loading..."}
              </span>
            </div>

            {/* Current Model */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Model</span>
              <span className="text-sm font-mono text-foreground">
                {currentModel}
              </span>
            </div>

            {/* Available Models */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3">Available Models</p>
              <div className="space-y-3">
                {versionInfo?.availableModels.map((model) => (
                  <div key={model.id} className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {model.name}
                      </span>
                      {model.contextWindow && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {model.contextWindow} context
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{model.description}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {model.modelId}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="pb-2">
          <h4 className="text-sm font-medium text-foreground">Claude Code</h4>
        </div>

        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-foreground">
                Claude Code Connection
              </span>
              {isClaudeCodeLoading ? (
                <span className="text-xs text-muted-foreground">
                  Checking...
                </span>
              ) : isClaudeCodeConnected ? (
                claudeCodeIntegration?.connectedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Connected on{" "}
                    {new Date(
                      claudeCodeIntegration.connectedAt,
                    ).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Connected
                  </span>
                )
              ) : (
                <span className="text-xs text-muted-foreground">
                  Not connected yet
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleClaudeCodeSetup}
              disabled={disconnectClaudeCode.isPending || isClaudeCodeLoading}
            >
              {isClaudeCodeConnected ? "Reconnect" : "Connect"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="pb-2">
          <h4 className="text-sm font-medium text-foreground">
            Override Model
          </h4>
        </div>
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="p-4 space-y-6">

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <Label className="text-sm font-medium">Model name</Label>
              <p className="text-xs text-muted-foreground">
                Model identifier to use for requests
              </p>
            </div>
            <div className="flex-shrink-0 w-80">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full"
                placeholder="claude-3-7-sonnet-20250219"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <Label className="text-sm font-medium">API token</Label>
              <p className="text-xs text-muted-foreground">
                ANTHROPIC_AUTH_TOKEN env
              </p>
            </div>
            <div className="flex-shrink-0 w-80">
              <Input
                type="password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value)
                }}
                className="w-full"
                placeholder="sk-ant-..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <Label className="text-sm font-medium">Base URL</Label>
              <p className="text-xs text-muted-foreground">
                ANTHROPIC_BASE_URL env
              </p>
            </div>
            <div className="flex-shrink-0 w-80">
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full"
                placeholder="https://api.anthropic.com"
              />
            </div>
          </div>
        </div>

        <div className="bg-muted p-3 rounded-b-lg flex justify-end gap-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={!canReset} className="hover:bg-red-500/10 hover:text-red-600">
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </div>
        </div>
      </div>

      {/* AWS Bedrock Environment Variables */}
      <div className="space-y-2">
        <div className="pb-2">
          <h4 className="text-sm font-medium text-foreground">
            AWS Bedrock Configuration
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Model IDs and token limits for AWS Bedrock API (only applies when using AWS auth mode)
          </p>
        </div>
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="p-4 space-y-6">
            {/* Opus Model */}
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <Label className="text-sm font-medium">Opus Model ID</Label>
                <p className="text-xs text-muted-foreground">
                  ANTHROPIC_DEFAULT_OPUS_MODEL
                </p>
              </div>
              <div className="flex-shrink-0 w-80">
                <Input
                  value={bedrockOpusModel}
                  onChange={(e) => setBedrockOpusModel(e.target.value)}
                  className="w-full font-mono text-xs"
                  placeholder="global.anthropic.claude-opus-4-5-20251101-v1:0"
                />
              </div>
            </div>

            {/* Sonnet Model */}
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <Label className="text-sm font-medium">Sonnet Model ID</Label>
                <p className="text-xs text-muted-foreground">
                  ANTHROPIC_DEFAULT_SONNET_MODEL
                </p>
              </div>
              <div className="flex-shrink-0 w-80">
                <Input
                  value={bedrockSonnetModel}
                  onChange={(e) => setBedrockSonnetModel(e.target.value)}
                  className="w-full font-mono text-xs"
                  placeholder="us.anthropic.claude-sonnet-4-5-20250929-v1:0[1m]"
                />
              </div>
            </div>

            {/* Haiku Model */}
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <Label className="text-sm font-medium">Haiku Model ID</Label>
                <p className="text-xs text-muted-foreground">
                  ANTHROPIC_DEFAULT_HAIKU_MODEL
                </p>
              </div>
              <div className="flex-shrink-0 w-80">
                <Input
                  value={bedrockHaikuModel}
                  onChange={(e) => setBedrockHaikuModel(e.target.value)}
                  className="w-full font-mono text-xs"
                  placeholder="us.anthropic.claude-haiku-4-5-20251001-v1:0[1m]"
                />
              </div>
            </div>

            {/* Max MCP Output Tokens */}
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <Label className="text-sm font-medium">Max MCP Output Tokens</Label>
                <p className="text-xs text-muted-foreground">
                  MAX_MCP_OUTPUT_TOKENS
                </p>
              </div>
              <div className="flex-shrink-0 w-80">
                <Input
                  type="number"
                  value={maxMcpOutputTokens}
                  onChange={(e) => setMaxMcpOutputTokens(e.target.value)}
                  className="w-full"
                  placeholder="200000"
                />
              </div>
            </div>

            {/* Max Thinking Tokens */}
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <Label className="text-sm font-medium">Max Thinking Tokens</Label>
                <p className="text-xs text-muted-foreground">
                  MAX_THINKING_TOKENS
                </p>
              </div>
              <div className="flex-shrink-0 w-80">
                <Input
                  type="number"
                  value={maxThinkingTokens}
                  onChange={(e) => setMaxThinkingTokens(e.target.value)}
                  className="w-full"
                  placeholder="1000000"
                />
              </div>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-b-lg flex justify-end gap-2 border-t">
            <Button
              size="sm"
              onClick={() => {
                updateSettings.mutate({
                  bedrockOpusModel: bedrockOpusModel || undefined,
                  bedrockSonnetModel: bedrockSonnetModel || undefined,
                  bedrockHaikuModel: bedrockHaikuModel || undefined,
                  maxMcpOutputTokens: maxMcpOutputTokens ? parseInt(maxMcpOutputTokens, 10) : undefined,
                  maxThinkingTokens: maxThinkingTokens ? parseInt(maxThinkingTokens, 10) : undefined,
                })
              }}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending && <span className="mr-2">...</span>}
              Save Bedrock Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
