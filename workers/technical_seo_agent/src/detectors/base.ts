/**
 * Base Detector Interface
 */

import { DetectorContext, DetectorResult } from '../models';

export interface Detector {
  readonly name: string;
  detect(context: DetectorContext): DetectorResult;
}
