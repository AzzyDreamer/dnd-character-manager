export type { BackgroundDefinition } from './types';

import { acolyte } from './acolyte';
import { artisan } from './artisan';
import { charlatan } from './charlatan';
import { criminal } from './criminal';
import { entertainer } from './entertainer';
import { farmer } from './farmer';
import { guard } from './guard';
import { guide } from './guide';
import { hermit } from './hermit';
import { merchant } from './merchant';
import { noble } from './noble';
import { sage } from './sage';
import { sailor } from './sailor';
import { scribe } from './scribe';
import { soldier } from './soldier';
import { wayfarer } from './wayfarer';

import type { BackgroundDefinition } from './types';

export const BACKGROUND_REGISTRY: BackgroundDefinition[] = [
  acolyte,
  artisan,
  charlatan,
  criminal,
  entertainer,
  farmer,
  guard,
  guide,
  hermit,
  merchant,
  noble,
  sage,
  sailor,
  scribe,
  soldier,
  wayfarer,
];

export const getBackgroundById = (id: string): BackgroundDefinition | undefined =>
  BACKGROUND_REGISTRY.find(b => b.id === id);

export const getBackgroundByName = (name: string): BackgroundDefinition | undefined =>
  BACKGROUND_REGISTRY.find(b => b.name === name);
