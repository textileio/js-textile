import typescript from "@wessberg/rollup-plugin-ts";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import inject from "@rollup/plugin-inject";
import { terser } from "rollup-plugin-terser";
import path from "path";

import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      exports: "named",
      file: path.resolve(pkg.bundle),
      format: "es",
    },
  ],
  external: ["stream"],
  plugins: [
    json(),
    resolve({
      preferBuiltins: false,
      browser: true,
    }),
    commonjs(),
    inject({
      Buffer: ["buffer/", "Buffer"],
    }),
    typescript(),
    terser(),
  ],
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  onwarn(warning, warn) {
    // suppress eval warnings
    if (warning.code === "EVAL") return;
    warn(warning);
  },
};
