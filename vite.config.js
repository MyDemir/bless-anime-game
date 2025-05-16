import { defineConfig } from 'vite';

export default defineConfig({
resolve: {
alias: {
'three': 'three',
'three/examples/jsm': 'three/examples/jsm'
}
}
});
