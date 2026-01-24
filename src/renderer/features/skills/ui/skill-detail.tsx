"use client"

import { useAtomValue } from "jotai"
import { selectedSkillAtom } from "../atoms"
import { SkillDetailHeader } from "./skill-detail-header"
import { SkillMarkdownView } from "./skill-markdown-view"

/**
 * Detail panel for viewing skill file content
 * Shows header with skill info and markdown view
 */
export function SkillDetail() {
  const selectedSkill = useAtomValue(selectedSkillAtom)

  if (!selectedSkill) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Select a skill to view details
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <SkillDetailHeader />
      <SkillMarkdownView />
    </div>
  )
}
