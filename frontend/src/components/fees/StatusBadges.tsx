import { AlertTriangle, CheckCircle2, Clock, CircleDashed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FEE_STATUS_LABELS } from '@/lib/utils';
import type { FeeStatus, StudentStatus } from '@/types';

// Status colors are always paired with an icon and a text label.
const FEE_STATUS_STYLE: Record<FeeStatus, { tone: 'green' | 'amber' | 'red' | 'orange'; icon: typeof CheckCircle2 }> = {
  paid: { tone: 'green', icon: CheckCircle2 },
  due: { tone: 'amber', icon: Clock },
  overdue: { tone: 'red', icon: AlertTriangle },
  partial: { tone: 'orange', icon: CircleDashed },
};

export function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const { tone, icon: Icon } = FEE_STATUS_STYLE[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden /> {FEE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return status === 'active' ? <Badge tone="blue">Active</Badge> : <Badge tone="neutral">Inactive</Badge>;
}
