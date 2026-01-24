"use client"

import { ClustersContent } from "../../../features/clusters/ui/clusters-content"
import { cn } from "../../../lib/utils"

interface ClustersTabContentProps {
  isMobileFullscreen?: boolean
  className?: string
}

export function ClustersTabContent({ className }: ClustersTabContentProps) {
  return (
    <div className={cn("flex-1 overflow-hidden", className)}>
      <ClustersContent />
    </div>
  )
}
