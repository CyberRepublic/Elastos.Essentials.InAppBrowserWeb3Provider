import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import alias from "@rollup/plugin-alias";

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/iab-web3-provider.ts',
	output: [
		{
			sourcemap: true,
			format: 'umd',
			file: 'dist/essentialsiabprovider.js'
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
			preferBuiltins: false,
			dedupe: ['']
		}),
		commonjs(),
		typescript({
			declaration: false,
			sourceMap: true,
			inlineSources: !production
		}),
		copy({
			targets: [
				{
					src: 'dist/essentialsiabprovider.js',
					dest: '../../App/src/assets/'
				}
			]
		})

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		//production && terser(),
	],
	watch: {
		clearScreen: true
	}
};