"use client"

import { useMemo } from "react"
import { useAtomValue } from "jotai"
import { ChevronRight, RefreshCw, FolderOpen } from "lucide-react"
import { selectedSkillAtom, selectedSkillCategoryAtom } from "../atoms"
import { selectedProjectAtom } from "../../agents/atoms"
import { trpc } from "../../../lib/trpc"

/**
 * Header for skill detail panel
 * Shows breadcrumb, skill info, and actions
 */
export function SkillDetailHeader() {
  const selectedSkill = useAtomValue(selectedSkillAtom)
  const selectedCategory = useAtomValue(selectedSkillCategoryAtom)
  const selectedProject = useAtomValue(selectedProjectAtom)
  const utils = trpc.useUtils()

  // Fetch skills to get metadata for the selected skill
  const { data: skills } = trpc.skills.list.useQuery(
    { cwd: selectedProject?.path },
    { enabled: !!selectedSkill }
  )

  // Find the current skill metadata
  const currentSkill = useMemo(() => {
    if (!skills || !selectedSkill) return null
    return skills.find((s) => s.path === selectedSkill)
  }, [skills, selectedSkill])

  const handleRefresh = async () => {
    await utils.skills.list.invalidate()
    console.log("[skills] Refreshed skills list")
  }

  // Mutation to open folder in finder
  const openInFinder = trpc.external.openInFinder.useMutation()

  const handleOpenFolder = () => {
    if (!selectedSkill) return
    // Open the skill folder in system file manager
    // The path points to SKILL.md, so we open that file's folder
    openInFinder.mutate(selectedSkill)
  }

  if (!selectedSkill || !currentSkill) return null

  // Extract skill name from path if not in metadata
  const skillName = currentSkill.name || selectedSkill.split("/").slice(-2, -1)[0] || "Unknown Skill"

  return (
    <div className="border-b bg-background p-4 space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Skills</span>
        <ChevronRight className="h-3 w-3" />
        <span className="capitalize">{currentSkill.source}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{skillName}</span>
      </div>

      {/* Title and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{skillName}</h2>
          {currentSkill.description && (
            <p className="text-sm text-muted-foreground">{currentSkill.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Open Folder Button */}
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            title="Open skill folder in file manager"
          >
            <FolderOpen className="h-4 w-4" />
            Open Folder
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            title="Refresh skills list"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
