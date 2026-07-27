import type { CellFacts } from './worldCell';
import type { SchemaGap } from './types';
import type { Burg } from '../fmg/burgs-generator';
export declare function auditCellSchema(facts: CellFacts, burg: Burg | undefined): SchemaGap[];
