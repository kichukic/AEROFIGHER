// Must be first: imports are hoisted, so polyfills live in their own module.
import './src/polyfills';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
