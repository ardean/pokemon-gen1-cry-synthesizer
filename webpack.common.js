const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  output: {
    filename: "pokemon-gen1-cry-synthesizer.js",
    path: path.resolve(__dirname, "docs"),
    globalObject: "typeof self !== 'undefined' ? self : this",
    library: "pokemon-gen1-cry-synthesizer",
    libraryTarget: "umd"
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development")
    })
  ]
};