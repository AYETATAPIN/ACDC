import { sharedMethods } from './methods/shared-methods.js';
import { canvasMethods } from './methods/canvas-methods.js';
import { connectionMethods } from './methods/connection-methods.js';
import { diagramMethods } from './methods/diagram-methods.js';

export const appMethods = {
  ...sharedMethods,
  ...canvasMethods,
  ...connectionMethods,
  ...diagramMethods,
};
