import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calculator } from 'lucide-react'
import { FunctionPointModal } from './FunctionPointModal'

interface FunctionPointBadgeProps {
  projectId: string
  sprintId?: string
  storyId: string
  storyTitle: string
  storyDescription?: string
  acceptanceCriteria?: string[]
  epic?: string
  priority?: string
  currentFP?: number
  onValidated?: (count: number) => void
}

export function FunctionPointBadge({
  projectId,
  sprintId,
  storyId,
  storyTitle,
  storyDescription,
  acceptanceCriteria,
  epic,
  priority,
  currentFP,
  onValidated,
}: FunctionPointBadgeProps) {
  const [open, setOpen] = useState(false)
  const [fp, setFp] = useState<number | undefined>(currentFP)

  const handleValidated = (count: number) => {
    setFp(count)
    onValidated?.(count)
  }

  return (
    <>
      {fp !== undefined ? (
        <button
          onClick={() => setOpen(true)}
          title="Recalcular Ponto de Função"
          className="inline-flex items-center gap-1"
        >
          <Badge variant="secondary" className="cursor-pointer gap-1 text-xs hover:bg-secondary/80">
            <Calculator className="h-3 w-3" />
            {fp} PF
          </Badge>
        </button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Calculator className="h-3 w-3" />
          Calcular PF
        </Button>
      )}

      <FunctionPointModal
        open={open}
        onClose={() => setOpen(false)}
        onValidated={handleValidated}
        projectId={projectId}
        sprintId={sprintId}
        storyId={storyId}
        storyTitle={storyTitle}
        storyDescription={storyDescription}
        acceptanceCriteria={acceptanceCriteria}
        epic={epic}
        priority={priority}
      />
    </>
  )
}
