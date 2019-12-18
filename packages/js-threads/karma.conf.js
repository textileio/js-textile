module.exports = function (config) {
  config.set({
    frameworks: ["mocha", "chai", "karma-typescript"],
    files: [
      "packages/*/src/**/*.ts"
    ],
    exclude: [],
    preprocessors: {
      "**/*.ts": ["karma-typescript"]
    },
    reporters: ["progress", "karma-typescript", "dots"],
    browsers: ["FirefoxHeadless"],
    singleRun: true,
    karmaTypescriptConfig: {
      tsconfig: "./tsconfig.json",
      reports: {
        html: 'coverage',
        'text-summary': '', // Destination "" will redirect output to the console
      },
      bundlerOptions: {
        addNodeGlobals: true,
        acornOptions: {
          ecmaVersion: 9,
        },
      }
    },
  });
};
