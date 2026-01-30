"use client"

import { useEffect, useMemo, useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  Rocket,
  ChevronRight,
  Loader2,
  BookOpen,
  FileText,
  RefreshCw,
  Download,
  Check,
  FolderOpen,
  ChevronDown,
} from "lucide-react"
import { cn } from "../../../lib/utils"
import { trpc } from "../../../lib/trpc"
import { selectedProjectAtom, selectedAgentChatIdAtom } from "../../agents/atoms"
import {
  selectedGsdCategoryAtom,
  activeGsdTabAtom,
  selectedGsdProjectIdAtom,
  gsdUpdateInfoAtom,
  gsdUpdateInProgressAtom,
  type GsdActiveTab,
} from "../../gsd/atoms"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"
import { Button } from "../../../components/ui/button"

interface GsdTabContentProps {
  isMobileFullscreen?: boolean
  className?: string
}

/**
 * Version badge component showing current GSD version and update status
 */
function VersionBadge({
  version,
  updateAvailable,
  isChecking,
}: {
  version: string | null
  updateAvailable: boolean
  isChecking: boolean
}) {
  if (isChecking) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">
        {version ? `v${version}` : "Not installed"}
      </span>
      {updateAvailable && (
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Update available" />
      )}
    </div>
  )
}

export function GsdTabContent({ className, isMobileFullscreen }: GsdTabContentProps) {
  const [activeTab, setActiveTab] = useAtom(activeGsdTabAtom)
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedGsdProjectIdAtom)
  const setSelectedCategory = useSetAtom(selectedGsdCategoryAtom)
  const setSelectedChatId = useSetAtom(selectedAgentChatIdAtom)
  const [updateInfo, setUpdateInfo] = useAtom(gsdUpdateInfoAtom)
  const [updateInProgress, setUpdateInProgress] = useAtom(gsdUpdateInProgressAtom)
  const selectedProject = useAtomValue(selectedProjectAtom)

  // Fetch GSD version
  const { data: versionData, isLoading: isLoadingVersion } = trpc.gsd.getVersion.useQuery()

  // Check for updates
  const { data: updateData, isLoading: isCheckingUpdates } = trpc.gsd.checkForUpdates.useQuery(
    undefined,
    {
      enabled: !!versionData?.version,
      refetchOnMount: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )

  // Update mutation
  const updateMutation = trpc.gsd.downloadUpdate.useMutation({
    onSuccess: (result) => {
      setUpdateInProgress(false)
      if (result.success) {
        // Show restart prompt - for now just refetch version
        window.location.reload()
      }
    },
    onError: () => {
      setUpdateInProgress(false)
    },
  })

  // Fetch projects for dropdown
  const { data: projectsData } = trpc.projects.list.useQuery()

  // Update updateInfo atom when data changes
  useEffect(() => {
    if (updateData) {
      setUpdateInfo({
        available: updateData.updateAvailable,
        currentVersion: updateData.currentVersion,
        latestVersion: updateData.latestVersion,
        releaseUrl: updateData.releaseUrl,
        releaseNotes: updateData.releaseNotes,
      })
    }
  }, [updateData, setUpdateInfo])

  // Find selected project object
  const selectedProjectObj = useMemo(() => {
    if (!projectsData || !selectedProjectId) return null
    return projectsData.find((p) => p.id === selectedProjectId) || null
  }, [projectsData, selectedProjectId])

  // Default to current workspace project if none selected
  useEffect(() => {
    if (!selectedProjectId && selectedProject?.id) {
      setSelectedProjectId(selectedProject.id)
    }
  }, [selectedProject, selectedProjectId, setSelectedProjectId])

  // Handle tab click - shows main content
  const handleTabClick = (tab: GsdActiveTab) => {
    setActiveTab(tab)
    setSelectedCategory("gsd")
    setSelectedChatId(null)
  }

  // Handle update download
  const handleUpdate = () => {
    if (updateData?.latestVersion && !updateInProgress) {
      setUpdateInProgress(true)
      updateMutation.mutate({ version: updateData.latestVersion })
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with logo, version, and update */}
      <div className="px-3 py-2 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">GSD</span>
          </div>
          <VersionBadge
            version={versionData?.version || null}
            updateAvailable={updateInfo?.available || false}
            isChecking={isCheckingUpdates}
          />
        </div>

        {/* Update button */}
        {updateInfo?.available && updateInfo.latestVersion && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUpdate}
            disabled={updateInProgress}
            className="w-full mt-2 h-7 text-xs"
          >
            {updateInProgress ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Download className="h-3 w-3 mr-1.5" />
                Update to v{updateInfo.latestVersion}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Project selector */}
      <div className="px-2 py-2 border-b border-border/50 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-foreground/5 text-left">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs truncate flex-1">
                {selectedProjectObj?.name || "Select project..."}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {projectsData?.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className="flex items-center gap-2"
              >
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate flex-1">{project.name}</span>
                {project.id === selectedProjectId && (
                  <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            {(!projectsData || projectsData.length === 0) && (
              <DropdownMenuItem disabled className="text-muted-foreground">
                No projects available
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tab navigation */}
      <div className="px-2 pt-2 flex-shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => handleTabClick("overview")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === "overview"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Overview
          </button>
          <button
            onClick={() => handleTabClick("plans")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === "plans"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Plans
          </button>
        </div>
      </div>

      {/* Quick links section */}
      <div className="flex-1 overflow-y-auto px-2 pt-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        <div className="space-y-0.5">
          {/* Overview quick links */}
          {activeTab === "overview" && (
            <>
              <p className="text-[10px] uppercase text-muted-foreground/70 font-medium px-2 mb-1">
                Documentation
              </p>
              {[
                { label: "README", icon: BookOpen },
                { label: "Commands", icon: FileText },
                { label: "Agents", icon: FileText },
                { label: "Changelog", icon: FileText },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleTabClick("overview")}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5 cursor-pointer w-full text-left"
                >
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-foreground">{item.label}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </>
          )}

          {/* Plans quick links */}
          {activeTab === "plans" && selectedProjectObj && (
            <ProjectPlanningFiles projectPath={selectedProjectObj.path} />
          )}

          {activeTab === "plans" && !selectedProjectObj && (
            <div className="flex flex-col items-center justify-center h-20 gap-2">
              <FolderOpen className="h-6 w-6 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground text-center">
                Select a project to view planning docs
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Component to display .planning files for a project
 */
function ProjectPlanningFiles({ projectPath }: { projectPath: string }) {
  const { data: hasDocs, isLoading: isCheckingDocs } = trpc.gsd.hasPlanningDocs.useQuery({
    projectPath,
  })

  const { data: docsData, isLoading: isLoadingDocs } = trpc.gsd.listPlanningDocs.useQuery(
    { projectPath },
    { enabled: hasDocs?.hasContent }
  )

  const setSelectedCategory = useSetAtom(selectedGsdCategoryAtom)
  const setSelectedChatId = useSetAtom(selectedAgentChatIdAtom)

  const handleDocClick = () => {
    setSelectedCategory("gsd")
    setSelectedChatId(null)
  }

  if (isCheckingDocs || isLoadingDocs) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasDocs?.exists) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-center px-4">
        <FileText className="h-6 w-6 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground">
          No .planning directory found
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          Run /gsd:map-codebase to initialize
        </span>
      </div>
    )
  }

  if (!docsData?.files || docsData.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-20 gap-2">
        <FileText className="h-6 w-6 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground">No planning files yet</span>
      </div>
    )
  }

  // Group files by top-level directory
  const topLevelItems = docsData.files.filter((f) => !f.path.includes("/"))

  return (
    <>
      <p className="text-[10px] uppercase text-muted-foreground/70 font-medium px-2 mb-1">
        Planning Files
      </p>
      {topLevelItems.map((file) => (
        <button
          key={file.path}
          onClick={handleDocClick}
          className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5 cursor-pointer w-full text-left"
        >
          {file.isDirectory ? (
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs text-foreground truncate">{file.name}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </>
  )
}
