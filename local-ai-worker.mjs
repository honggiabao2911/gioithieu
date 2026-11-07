import { WebWorkerMLCEngineHandler } from './assets/vendor/webllm-0.2.87.mjs';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = event => handler.onmessage(event);
