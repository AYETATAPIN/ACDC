import { sharedMethods } from './methods/shared-methods.js';
import { canvasMethods } from './methods/canvas-methods.js';
import { connectionMethods } from './methods/connection-methods.js';
import { diagramMethods } from './methods/diagram-methods.js';
import { authMethods } from './methods/auth-methods.js';

export const appMethods = {
  ...authMethods,
  ...sharedMethods,
  ...canvasMethods,
  ...connectionMethods,
  ...diagramMethods,
};
