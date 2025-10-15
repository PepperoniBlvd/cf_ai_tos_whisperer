import { React, createRoot } from './lib/react.js';
import { App } from './App.js';

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));

