// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')

const extensions = ['.tsx', '.ts', '.js', 'json']

module.exports = {
  entry: './src/index.ts',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolveLoader: {
    modules: ['../../node_modules'],
  },
  resolve: {
    modules: ['./node_modules'],
    extensions,
    symlinks: false,
    alias: {
      '@textile/threads-core': path.resolve(__dirname, 'packages/core'),
      '@textile/threads-database': path.resolve(__dirname, 'packages/database'),
      '@textile/threads-encoding': path.resolve(__dirname, 'packages/encoding'),
      '@textile/threads-id': path.resolve(__dirname, 'packages/id'),
      '@textile/threads-multiaddr': path.resolve(__dirname, 'packages/multiaddr'),
      '@textile/threads-network': path.resolve(__dirname, 'packages/network'),
      '@textile/threads-network-client': path.resolve(__dirname, 'packages/network-client'),
      '@textile/threads-store': path.resolve(__dirname, 'packages/store'),
    },
  },
  output: {
    filename: './[name].js',
    path: path.resolve(process.cwd(), 'dist'),
    library: 'threads',
    libraryTarget: 'var',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
    minimize: true,
  },
}
