"use client"

import { useMemo, useRef, useEffect } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Search, Loader2, Sparkles } from "lucide-react"
import { trpc } from "../../../lib/trpc"
import { selectedSkillAtom, skillFileListSearchAtom } from "../atoms"
import { selectedProjectAtom } from "../../agents/atoms"
import { cn } from "../../../lib/utils"
import { Input } from "../../../components/ui/input"

/**
 * Badge component to show the source of a skill
 */
function SourceBadge({ source }: { source: "user" | "project" | "custom" }) {
  const colors = {
    project: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    user: "bg-green-500/10 text-green-600 dark:text-green-400",
    custom: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }

  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wide",
        colors[source],
      )}
    >
      {source}
    </span>
  )
}

/**
 * File list sidebar for skills
 * Shows filtered list of skills grouped by source
 */
export function SkillFileList() {
  const [selectedSkill, setSelectedSkill] = useAtom(selectedSkillAtom)
  const [searchQuery, setSearchQuery] = useAtom(skillFileListSearchAtom)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedProject = useAtomValue(selectedProjectAtom)

  // Fetch skills data
  const { data: skills, isLoading, error } = trpc.skills.list.useQuery(
    { cwd: selectedProject?.path },
    {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  )

  // Debug logging
  useEffect(() => {
    console.log("[skill-file-list] Component mounted")
    console.log("[skill-file-list] isLoading:", isLoading, "hasData:", !!skills, "error:", error)
    if (skills) {
      console.log("[skill-file-list] Skills count:", skills.length)
    }
  }, [isLoading, skills, error])

  // Filter skills by search query
  const filteredSkills = useMemo(() => {
    if (!skills) return []
    if (!searchQuery.trim()) return skills

    const query = searchQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query)
    )
  }, [skills, searchQuery])

  // Group skills by source
  const groupedSkills = useMemo(() => {
    const groups: Record<string, typeof filteredSkills> = {
      project: [],
      user: [],
      custom: [],
    }

    for (const skill of filteredSkills) {
      groups[skill.source].push(skill)
    }

    return groups
  }, [filteredSkills])

  const sourceLabels: Record<string, string> = {
    project: "Project Skills",
    user: "User Skills",
    custom: "Custom Skills",
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F or Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSkillClick = (skill: typeof filteredSkills[0]) => {
    setSelectedSkill(skill.path)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="p-3 border-b space-y-3">
        <h3 className="text-sm font-semibold">Skills</h3>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-sm text-destructive">
            Error loading skills: {error.message}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery ? "No results found" : "No skills found"}
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(groupedSkills)
              .filter(([_, skillList]) => skillList.length > 0)
              .map(([source, skillList]) => (
                <div key={source} className="mb-3">
                  {/* Source Group Header */}
                  <div className="flex items-center h-6 mb-1 px-3">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      {sourceLabels[source]}
                    </h4>
                  </div>

                  {/* Skills in Group */}
                  <div>
                    {skillList.map((skill) => (
                      <button
                        key={skill.path}
                        onClick={() => handleSkillClick(skill)}
                        className={cn(
                          "flex items-start gap-2 w-full px-3 py-2 text-left transition-colors",
                          selectedSkill === skill.path
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {skill.name}
                            </span>
                            <SourceBadge source={skill.source} />
                          </div>
                          {skill.description && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {skill.description}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
