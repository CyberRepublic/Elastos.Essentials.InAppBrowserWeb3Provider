import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import alias from "@rollup/plugin-alias";
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/iab-web3-provider.ts',
	output: [
		{
			sourcemap: !production,
			format: 'iife',
			file: 'dist/essentialsiabweb3provider.js'
		},
	],
	external: [
		/* "@elastosfoundation/did-js-sdk",
		"moment",
		"rxjs" */
	],
	plugins: [
		alias({
			"entries": [
				{ "find": "buffer", "replacement": "node_modules/buffer/index.js" },
				{ "find": "stream", "replacement": "node_modules/stream/index.js" },
				{ "find": "events", "replacement": "node_modules/events/events.js" }
			]
		}),
		resolve({
			browser: true,
			preferBuiltins: true,
			dedupe: ['']
		}),
		commonjs(),
		typescript({
			declaration: false,
			sourceMap: !production,
			inlineSources: !production
		}),
		copy({
			targets: [
				{
					src: 'dist/essentialsiabweb3provider.js',
					dest: '../../App/src/assets/'
				}
			]
		}),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser(),
	],
	watch: {
		clearScreen: true
	}
};