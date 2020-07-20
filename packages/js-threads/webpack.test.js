module.exports = {
  target: "web",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  node: {
    crypto: "empty",
  },
  performance: {
    hints: false,
  },
  resolveLoader: {
    modules: ["../../node_modules"],
  },
  resolve: {
    modules: ["./node_modules"],
    extensions: [".tsx", ".ts", ".js"],
  },
}
