import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SessionFlowPanel } from "./session-flow-panel"

interface SessionFlowDialogProps {
  isOpen: boolean
  onClose: () => void
  onScrollToMessage: (messageId: string, partIndex?: number) => void
}

export function SessionFlowDialog({ isOpen, onClose, onScrollToMessage }: SessionFlowDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Session Flow</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <SessionFlowPanel onScrollToMessage={onScrollToMessage} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
