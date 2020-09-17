import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";
import path from "path";

const defaults = {
  input: "src/index.ts",
  external: [...Object.keys(pkg.dependencies || {})],
  plugins: [typescript()],
};

const dir = path.dirname(pkg.module);

export default [
  {
    ...defaults,
    output: [
      { file: pkg.main, format: "cjs" },
      {
        file: pkg.browser,
        name: "ThreadDB",
        format: "iife",
        globals: {
          dexie: "Dexie",
        },
      },
    ],
  },
  {
    ...defaults,
    plugins: [
      typescript({
        declaration: true,
        declarationDir: dir,
        declarationMap: true,
      }),
    ],
    output: [{ dir, format: "es", sourcemap: true }],
  },
];
