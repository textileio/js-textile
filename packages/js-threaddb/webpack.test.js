module.exports = {
  target: "web",
  entry: ["@babel/polyfill"],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  performance: {
    hints: false,
  },
  resolve: {
    modules: ["./node_modules"],
    extensions: [".tsx", ".ts", ".js"],
  },
};
