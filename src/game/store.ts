import { runtime } from '../runtime/client';
import { createGame } from './controller';

export const useGame = createGame(runtime);
